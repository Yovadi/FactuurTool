import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { supabase, type Invoice, type Lease, type Tenant, type ExternalCustomer, type LeaseSpace, type OfficeSpace, type InvoiceLineItem } from '../lib/supabase';
import { Plus, FileText, Eye, Calendar, CheckCircle, Download, Trash2, Send, CreditCard as Edit, Search, CreditCard as Edit2, AlertCircle, AlertTriangle, CheckSquare, Square, Check, X, Home, Zap, RefreshCw, CheckCircle2, Loader2, Filter, RotateCcw } from 'lucide-react';
import { syncInvoiceToEBoekhouden, checkInvoicePaymentStatuses } from '../lib/eboekhoudenSync';
import { generateInvoicePDF, generateInvoicePDFBase64 } from '../utils/pdfGenerator';
import { isEmailConfigured, sendEmail, getActiveEmailMethodLabel } from '../utils/emailSender';
import { buildInvoiceEmailHtml, buildInvoiceEmailText } from '../utils/emailTemplate';
import { InvoicePreview } from './InvoicePreview';
import { Toast } from './Toast';
import { checkAndRunScheduledJobs } from '../utils/scheduledJobs';
import { getLocalRootFolderPath } from '../utils/localSettings';
import { syncInvoicePDFs } from '../utils/invoicePdfSync';

type LeaseWithDetails = Lease & {
  tenant: Tenant;
  lease_spaces: (LeaseSpace & { space: OfficeSpace })[];
};

type InvoiceWithDetails = Invoice & {
  lease?: LeaseWithDetails | null;
  tenant?: Tenant | null;
  external_customer?: ExternalCustomer | null;
};

// Helper function to convert invoice line items to spaces with proper type detection
function convertLineItemsToSpaces(items: InvoiceLineItem[]) {
  return items.map(item => {
    let spaceType: string = 'diversen';
    let isMeetingRoom = false;
    let isKnownSpaceType = false;
    let isDiscount = false;

    if (item.description.toLowerCase().includes('korting') || item.amount < 0) {
      isDiscount = true;
      spaceType = 'discount';
    } else if (item.booking_id) {
      isMeetingRoom = true;
    } else if (item.description.toLowerCase().includes('voorschot')) {
      spaceType = 'voorschot';
    } else if (item.description.startsWith('Hal ')) {
      spaceType = 'bedrijfsruimte';
      isKnownSpaceType = true;
    } else if (item.description.startsWith('Kantoor ')) {
      spaceType = 'kantoor';
      isKnownSpaceType = true;
    } else if (item.description.toLowerCase().startsWith('buitenterrein')) {
      spaceType = 'buitenterrein';
      isKnownSpaceType = true;
    } else if (item.description.toLowerCase().includes('vergader') || item.description.toLowerCase().includes('meeting')) {
      isMeetingRoom = true;
    } else if (item.description.toLowerCase().includes('flexplek') || item.description.toLowerCase().includes('flex')) {
      spaceType = 'flex';
      isKnownSpaceType = true;
    }

    let squareFootage: number | undefined = undefined;
    let hours: number | undefined = undefined;
    let hourlyRate: number | undefined = undefined;
    let pricePerSqm: number | undefined = undefined;
    let cleanDescription = item.description;

    if (isMeetingRoom) {
      if (item.quantity !== null && item.quantity !== undefined) {
        const parsed = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
        if (!isNaN(parsed) && parsed > 0) {
          hours = parsed;
          hourlyRate = item.unit_price;

          const hoursMatch = cleanDescription.match(/\([\d.]+\s*u(?:ur)?\)/i);
          if (hoursMatch) {
            cleanDescription = cleanDescription.replace(hoursMatch[0], '').trim();
          }
        }
      }
    } else if (item.quantity !== null && item.quantity !== undefined && !isDiscount) {
      const parsed = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
      if (!isNaN(parsed) && parsed > 0) {
        squareFootage = parsed;
        pricePerSqm = item.unit_price;
      }
    }

    return {
      space_name: cleanDescription,
      monthly_rent: item.amount,
      space_type: spaceType as any,
      square_footage: squareFootage,
      price_per_sqm: pricePerSqm,
      hours: hours,
      hourly_rate: hourlyRate
    };
  });
}

function getLocalCategory(spaceType?: string, bookingType?: string): string | null {
  if (bookingType === 'meeting_room') return 'vergaderruimte';
  if (bookingType === 'flex') return 'flexplek';
  switch (spaceType) {
    case 'kantoor': return 'huur_kantoor';
    case 'bedrijfsruimte': return 'huur_bedrijfsruimte';
    case 'buitenterrein': return 'huur_buitenterrein';
    case 'flexplek': return 'flexplek';
    case 'diversen': return 'diversen';
    default: return null;
  }
}

export type InvoiceTypeFilter = 'all' | 'huur' | 'vergaderruimte' | 'flex' | 'handmatig';

export interface InvoiceManagementRef {
  openGenerateModal: () => Promise<void>;
  openGenerateHuurModal: () => Promise<void>;
  openGenerateBookingsModal: () => Promise<void>;
}

type InvoiceManagementProps = {
  onCreateCreditNote?: (invoice: any, tenant: any, spaces: any[]) => void;
  invoiceTypeFilter?: InvoiceTypeFilter;
};

export const InvoiceManagement = forwardRef<any, InvoiceManagementProps>(({ onCreateCreditNote, invoiceTypeFilter = 'all' }, ref) => {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [leases, setLeases] = useState<LeaseWithDetails[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [externalCustomers, setExternalCustomers] = useState<ExternalCustomer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [invoiceMode, setInvoiceMode] = useState<'lease' | 'manual'>('lease');
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<{
    invoice: InvoiceWithDetails;
    spaces: any[];
  } | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [emailComposeData, setEmailComposeData] = useState<{
    to: string;
    toName: string;
    subject: string;
    body: string;
    html: string;
    invoiceId: string;
  } | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState<string>('');
  const [invoicedMonths, setInvoicedMonths] = useState<{
    leaseCount: Map<string, number>;
    meetingRoomCount: Map<string, number>;
  }>({
    leaseCount: new Map(),
    meetingRoomCount: new Map()
  });
  const [selectedLeases, setSelectedLeases] = useState<Set<string>>(new Set());
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [meetingRoomBookings, setMeetingRoomBookings] = useState<any[]>([]);
  const [flexDayBookings, setFlexDayBookings] = useState<any[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateModalType, setGenerateModalType] = useState<'all' | 'huur' | 'bookings'>('all');
  const [showDetailSelection, setShowDetailSelection] = useState(true);
  const [syncingInvoiceId, setSyncingInvoiceId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [eBoekhoudenPaidWarning, setEBoekhoudenPaidWarning] = useState<{ invoiceId: string; invoiceNumber: string } | null>(null);
  const [eBoekhoudenBatchPaidWarning, setEBoekhoudenBatchPaidWarning] = useState<{ syncedCount: number; totalCount: number } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [filterType, setFilterType] = useState<InvoiceTypeFilter>('all');
  const [filterCustomer, setFilterCustomer] = useState<string>('all');
  const [pdfSyncStatus, setPdfSyncStatus] = useState<{
    active: boolean;
    current: number;
    total: number;
    invoiceNumber: string;
    result?: { synced: number; failed: number } | null;
  }>({ active: false, current: 0, total: 0, invoiceNumber: '' });

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleSyncToEBoekhouden = async (invoice: InvoiceWithDetails) => {
    if (!companySettings?.eboekhouden_api_token || !companySettings?.eboekhouden_connected) return;
    const customer = invoice.tenant || invoice.external_customer;
    if (!customer) return;
    const customerType = invoice.tenant ? 'tenant' : 'external';
    setSyncingInvoiceId(invoice.id);
    try {
      const { data: lineItems } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoice.id);
      const invoiceWithItems = { ...invoice, line_items: lineItems || [] };
      const result = await syncInvoiceToEBoekhouden(
        companySettings.eboekhouden_api_token,
        invoiceWithItems,
        customer as any,
        customerType as 'tenant' | 'external',
        companySettings
      );
      if (result.success) {
        await refreshInvoices();
      } else {
        showToast(result.error || 'Synchronisatie mislukt', 'error');
      }
    } catch {
      showToast('Fout bij synchronisatie naar e-Boekhouden', 'error');
    } finally {
      setSyncingInvoiceId(null);
    }
  };

  useImperativeHandle(ref, () => ({
    openGenerateModal: async () => {
      const defaultMonth = await getDefaultInvoiceMonth(invoiceTypeFilter);
      setInvoiceMonth(defaultMonth);
      setGenerateModalType('all');
      setShowGenerateModal(true);
    },
    openGenerateHuurModal: async () => {
      const defaultMonth = await getDefaultInvoiceMonth('huur');
      setInvoiceMonth(defaultMonth);
      setGenerateModalType('huur');
      setShowGenerateModal(true);
    },
    openGenerateBookingsModal: async () => {
      const defaultMonth = await getDefaultInvoiceMonth('vergaderruimte');
      setInvoiceMonth(defaultMonth);
      setGenerateModalType('bookings');
      setShowGenerateModal(true);
    }
  }));

  const getDefaultInvoiceMonth = async (type?: InvoiceTypeFilter) => {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('test_mode, test_date')
      .maybeSingle();

    let currentDate = new Date();
    if (settings?.test_mode === true && settings?.test_date) {
      currentDate = new Date(settings.test_date);
    }

    console.log('Current date for invoice generation:', currentDate.toISOString());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (type === 'huur') {
      const nextMonth = month + 1;
      const nextYear = nextMonth > 11 ? year + 1 : year;
      const finalMonth = nextMonth > 11 ? 0 : nextMonth;
      const result = `${nextYear}-${String(finalMonth + 1).padStart(2, '0')}`;
      console.log('Default month for rent (next month):', result);
      return result;
    } else if (type === 'vergaderruimte' || type === 'flex') {
      const result = `${year}-${String(month + 1).padStart(2, '0')}`;
      console.log('Default month for bookings (current month):', result);
      return result;
    } else {
      const nextMonth = month + 1;
      const nextYear = nextMonth > 11 ? year + 1 : year;
      const finalMonth = nextMonth > 11 ? 0 : nextMonth;
      const result = `${nextYear}-${String(finalMonth + 1).padStart(2, '0')}`;
      return result;
    }
  };

  const getNextMonthString = async () => {
    return getDefaultInvoiceMonth('huur');
  };

  const fetchMeetingRoomBookingsForMonth = async (customerId: string, invoiceMonth: string, customerType: 'tenant' | 'external' = 'tenant') => {
    if (!invoiceMonth) return [];

    const [year, month] = invoiceMonth.split('-').map(Number);

    // Format dates without timezone conversion
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    console.log('Fetching bookings for customer:', customerId, 'type:', customerType);
    console.log('Date range:', startDateStr, 'to', endDateStr);

    // Fetch meeting room bookings
    let meetingQuery = supabase
      .from('meeting_room_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        total_hours,
        total_amount,
        hourly_rate,
        discount_percentage,
        discount_amount,
        rate_type,
        applied_rate,
        status,
        invoice_id,
        office_spaces(space_number)
      `)
      .gte('booking_date', startDateStr)
      .lte('booking_date', endDateStr)
      .eq('status', 'completed')
      .is('invoice_id', null);

    if (customerType === 'tenant') {
      meetingQuery = meetingQuery.eq('tenant_id', customerId);
    } else {
      meetingQuery = meetingQuery.eq('external_customer_id', customerId);
    }

    const { data: meetingBookings, error: meetingError } = await meetingQuery;

    if (meetingError) {
      console.error('Error fetching meeting room bookings:', meetingError);
    }

    // Fetch flex day bookings
    let flexQuery = supabase
      .from('flex_day_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        total_hours,
        total_amount,
        hourly_rate,
        is_half_day,
        half_day_period,
        status,
        invoice_id,
        lease_id,
        external_customer_id,
        leases(tenant_id),
        office_spaces(space_number)
      `)
      .gte('booking_date', startDateStr)
      .lte('booking_date', endDateStr)
      .eq('status', 'completed')
      .is('invoice_id', null);

    if (customerType === 'tenant') {
      flexQuery = flexQuery.not('lease_id', 'is', null);
    } else {
      flexQuery = flexQuery.not('external_customer_id', 'is', null).eq('external_customer_id', customerId);
    }

    const { data: flexBookings, error: flexError } = await flexQuery;

    if (flexError) {
      console.error('Error fetching flex day bookings:', flexError);
    }

    // Filter flex bookings for tenant type
    const filteredFlexBookings = customerType === 'tenant'
      ? (flexBookings || []).filter(booking => booking.leases?.tenant_id === customerId)
      : flexBookings || [];

    // Combine all bookings
    const allBookings = [
      ...(meetingBookings || []).map(booking => ({
        ...booking,
        space: booking.office_spaces,
        booking_type: 'meeting_room'
      })),
      ...(filteredFlexBookings).map(booking => ({
        ...booking,
        space: booking.office_spaces,
        status: 'completed',
        booking_type: 'flex'
      }))
    ];

    console.log('Total bookings found:', allBookings.length, '(meeting:', meetingBookings?.length || 0, 'flex:', flexBookings?.length || 0, ')');

    return allBookings;
  };

  const fetchFlexDayBookings = async (customerId: string, customerType: 'tenant' | 'external', year: number, month: number) => {
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    let query = supabase
      .from('flex_day_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        total_hours,
        total_amount,
        hourly_rate,
        is_half_day,
        half_day_period,
        status,
        invoice_id,
        lease_id,
        external_customer_id,
        leases(tenant_id),
        office_spaces(space_number)
      `)
      .gte('booking_date', startDateStr)
      .lte('booking_date', endDateStr)
      .eq('status', 'completed')
      .is('invoice_id', null);

    if (customerType === 'tenant') {
      query = query.not('lease_id', 'is', null);
    } else {
      query = query.not('external_customer_id', 'is', null).eq('external_customer_id', customerId);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error('Error fetching flex day bookings:', error);
      return [];
    }

    // Filter for tenant type based on lease tenant_id
    const filteredBookings = customerType === 'tenant'
      ? (bookings || []).filter(booking => booking.leases?.tenant_id === customerId)
      : bookings || [];

    return filteredBookings.map(booking => ({
      ...booking,
      space: booking.office_spaces,
      status: 'completed'
    }));
  };

  const [formData, setFormData] = useState({
    lease_id: '',
    tenant_id: '',
    external_customer_id: '',
    customer_type: 'tenant' as 'tenant' | 'external',
    invoice_date: '',
    due_date: '',
    invoice_month: '',
    vat_rate: '21',
    vat_inclusive: false,
    reference_number: '',
    payment_term_days: '14',
    notes: ''
  });

  const [lineItems, setLineItems] = useState<Array<{
    description: string;
    unit_price: string;
    quantity?: string;
    space_type?: string;
    bookingId?: string;
    bookingType?: 'meeting_room' | 'flex';
    local_category?: string | null;
    grootboek_id?: number | null;
  }>>([]);
  const [grootboekMappings, setGrootboekMappings] = useState<Array<{
    id: string;
    local_category: string;
    grootboek_code: string;
    grootboek_id: number;
    grootboek_omschrijving: string;
  }>>([]);

  useEffect(() => {
    const initializeForm = async () => {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('test_mode, test_date')
        .maybeSingle();

      let currentDate = new Date();
      if (settings?.test_mode && settings?.test_date) {
        currentDate = new Date(settings.test_date);
      }

      const dueDateObj = new Date(currentDate);
      dueDateObj.setDate(dueDateObj.getDate() + 14);

      const nextMonth = await getNextMonthString();
      setInvoiceMonth(nextMonth);
      setFormData(prev => ({
        ...prev,
        invoice_month: nextMonth,
        invoice_date: currentDate.toISOString().split('T')[0],
        due_date: dueDateObj.toISOString().split('T')[0]
      }));
    };

    initializeForm();
    loadData();
    checkAndRunScheduledJobs();
    localStorage.setItem('hal5-invoices-last-seen', new Date().toISOString());
    window.dispatchEvent(new CustomEvent('invoices-seen'));

    const interval = setInterval(() => {
      checkAndRunScheduledJobs();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const electron = (window as any).electron;
    if (!electron?.onPreviewAction) return;

    electron.onPreviewAction((action: string, data: any) => {
      if (action === 'invoice-edit' && data?.invoiceId) {
        const inv = invoices.find(i => i.id === data.invoiceId);
        if (inv) {
          setPreviewInvoice(null);
          startEditInvoice(inv);
        }
      } else if (action === 'invoice-download' && data?.invoiceId) {
        const inv = invoices.find(i => i.id === data.invoiceId);
        if (inv && previewInvoice) {
          handlePreviewDownload();
        }
      } else if (action === 'invoice-send' && data?.invoiceId) {
        const inv = invoices.find(i => i.id === data.invoiceId);
        if (inv && previewInvoice) {
          handlePreviewSend();
        }
      } else if (action === 'invoice-mark-paid' && data?.invoiceId) {
        markAsPaid(data.invoiceId);
      } else if (action === 'invoice-create-credit-note' && data?.invoiceId) {
        const inv = invoices.find(i => i.id === data.invoiceId);
        if (inv && onCreateCreditNote) {
          const tenant = getInvoiceTenant(inv);
          if (tenant && previewInvoice) {
            onCreateCreditNote(inv, tenant, previewInvoice.spaces);
            setPreviewInvoice(null);
          }
        }
      } else if (action === 'invoice-revert-draft' && data?.invoiceId) {
        revertToDraft(data.invoiceId);
      } else if (action === 'invoice-delete' && data?.invoiceId) {
        deleteInvoice(data.invoiceId);
      }
    });
  }, [invoices, previewInvoice]);

  useEffect(() => {
    updateInvoicedMonthsCounts();
  }, [invoices]);

  useEffect(() => {
    return () => {
      const splitscreen = localStorage.getItem('hal5-splitscreen') === 'true';
      const electron = (window as any).electron;
      if (splitscreen && electron?.closePreviewWindow) {
        electron.closePreviewWindow();
      }
    };
  }, []);

  const loadData = async () => {
    setLoading(true);

    const [{ data: companyData }, localPath] = await Promise.all([
      supabase.from('company_settings').select('*').maybeSingle(),
      getLocalRootFolderPath(),
    ]);

    if (companyData && localPath) {
      companyData.root_folder_path = localPath;
    }
    setCompanySettings(companyData);

    const { data: tenantsData } = await supabase
      .from('tenants')
      .select('*')
      .order('company_name');

    setTenants(tenantsData || []);

    const { data: externalCustomersData } = await supabase
      .from('external_customers')
      .select('*')
      .order('company_name');

    setExternalCustomers(externalCustomersData || []);

    const { data: leasesData } = await supabase
      .from('leases')
      .select(`
        *,
        tenant:tenants(*),
        lease_spaces:lease_spaces(
          *,
          space:office_spaces(*)
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    setLeases(leasesData as LeaseWithDetails[] || []);

    const { data: invoicesData } = await supabase
      .from('invoices')
      .select(`
        *,
        lease:leases(
          *,
          tenant:tenants(*),
          lease_spaces:lease_spaces(
            *,
            space:office_spaces(*)
          )
        ),
        tenant:tenants(*),
        external_customer:external_customers(*),
        line_items:invoice_line_items(*)
      `)
      .order('created_at', { ascending: false });

    setInvoices(invoicesData as InvoiceWithDetails[] || []);

    if (companyData?.eboekhouden_api_token && companyData?.eboekhouden_connected) {
      checkInvoicePaymentStatuses(companyData.eboekhouden_api_token).then(result => {
        if (result.updated > 0) {
          supabase
            .from('invoices')
            .select(`
              *,
              lease:leases(
                *,
                tenant:tenants(*),
                lease_spaces:lease_spaces(
                  *,
                  space:office_spaces(*)
                )
              ),
              tenant:tenants(*),
              external_customer:external_customers(*),
              line_items:invoice_line_items(*)
            `)
            .order('created_at', { ascending: false })
            .then(({ data }) => {
              if (data) setInvoices(data as InvoiceWithDetails[]);
            });
        }
      }).catch(() => {});
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const { data: pastConfirmedMeetings } = await supabase
      .from('meeting_room_bookings')
      .select('id')
      .eq('status', 'confirmed')
      .lt('booking_date', todayStr);

    if (pastConfirmedMeetings && pastConfirmedMeetings.length > 0) {
      await supabase
        .from('meeting_room_bookings')
        .update({ status: 'completed' })
        .in('id', pastConfirmedMeetings.map(b => b.id));
    }

    const { data: bookingsData } = await supabase
      .from('meeting_room_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        total_hours,
        total_amount,
        status,
        invoice_id,
        tenant_id,
        external_customer_id,
        space:office_spaces(space_number)
      `)
      .eq('status', 'completed')
      .order('booking_date', { ascending: false });

    setMeetingRoomBookings(bookingsData || []);
    const { data: pastConfirmedFlex } = await supabase
      .from('flex_day_bookings')
      .select('id')
      .eq('status', 'confirmed')
      .lt('booking_date', todayStr);

    if (pastConfirmedFlex && pastConfirmedFlex.length > 0) {
      await supabase
        .from('flex_day_bookings')
        .update({ status: 'completed' })
        .in('id', pastConfirmedFlex.map(b => b.id));
    }

    const { data: flexBookingsData } = await supabase
      .from('flex_day_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        total_hours,
        total_amount,
        status,
        invoice_id,
        external_customer_id,
        lease_id,
        leases(tenant_id),
        space:office_spaces(space_number)
      `)
      .eq('status', 'completed')
      .order('booking_date', { ascending: false });

    const flexWithTenantId = (flexBookingsData || []).map((b: any) => ({
      ...b,
      tenant_id: b.leases?.tenant_id || null
    }));

    setFlexDayBookings(flexWithTenantId);

    const { data: mappingsData } = await supabase
      .from('eboekhouden_grootboek_mapping')
      .select('*')
      .order('local_category');

    setGrootboekMappings(mappingsData || []);

    setLoading(false);

    triggerPdfSync();
  };

  const triggerPdfSync = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.listInvoicesOnDisk || !electronAPI?.savePDF) return;
    if (pdfSyncStatus.active) return;

    try {
      setPdfSyncStatus({ active: true, current: 0, total: 0, invoiceNumber: '' });
      const result = await syncInvoicePDFs((current, total, invoiceNumber) => {
        setPdfSyncStatus({ active: true, current, total, invoiceNumber });
      });

      if (!result || result.synced === 0) {
        setPdfSyncStatus(prev => ({ ...prev, active: false }));
        return;
      }

      setPdfSyncStatus({
        active: false,
        current: result.synced,
        total: result.synced + result.failed,
        invoiceNumber: '',
        result: { synced: result.synced, failed: result.failed },
      });

      showToast(`${result.synced} ontbrekende PDF${result.synced !== 1 ? "'s" : ''} gesynchroniseerd`, 'success');

      setTimeout(() => {
        setPdfSyncStatus(prev => prev.result ? { ...prev, result: null } : prev);
      }, 6000);
    } catch {
      setPdfSyncStatus(prev => ({ ...prev, active: false }));
    }
  };

  const refreshInvoices = async () => {
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select(`
        *,
        lease:leases(
          *,
          tenant:tenants(*),
          lease_spaces:lease_spaces(
            *,
            space:office_spaces(*)
          )
        ),
        tenant:tenants(*),
        external_customer:external_customers(*),
        line_items:invoice_line_items(*)
      `)
      .order('created_at', { ascending: false });

    setInvoices(invoicesData as InvoiceWithDetails[] || []);
  };

  const calculateVAT = (baseAmount: number, vatRate: number, vatInclusive: boolean) => {
    if (vatInclusive) {
      const total = Math.round(baseAmount * 100) / 100;
      const subtotal = Math.round((baseAmount / (1 + (vatRate / 100))) * 100) / 100;
      const vatAmount = Math.round((baseAmount - subtotal) * 100) / 100;
      return { subtotal, vatAmount, total };
    } else {
      const subtotal = Math.round(baseAmount * 100) / 100;
      const vatAmount = Math.round((baseAmount * (vatRate / 100)) * 100) / 100;
      const total = Math.round((baseAmount + vatAmount) * 100) / 100;
      return { subtotal, vatAmount, total };
    }
  };

  const updateInvoicedMonthsCounts = () => {
    const leaseMonthCounts = new Map<string, number>();
    const meetingRoomMonthCounts = new Map<string, number>();

    invoices.forEach(inv => {
      if (inv.invoice_month) {
        if (inv.lease_id) {
          leaseMonthCounts.set(inv.invoice_month, (leaseMonthCounts.get(inv.invoice_month) || 0) + 1);
        } else {
          meetingRoomMonthCounts.set(inv.invoice_month, (meetingRoomMonthCounts.get(inv.invoice_month) || 0) + 1);
        }
      }
    });

    setInvoicedMonths({
      leaseCount: leaseMonthCounts,
      meetingRoomCount: meetingRoomMonthCounts
    });
  };

  const toggleLeaseSelection = (leaseId: string) => {
    setSelectedLeases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leaseId)) {
        newSet.delete(leaseId);
      } else {
        newSet.add(leaseId);
      }
      return newSet;
    });
  };

  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  const selectAllLeases = (leaseIds: string[]) => {
    setSelectedLeases(new Set(leaseIds));
  };

  const deselectAllLeases = () => {
    setSelectedLeases(new Set());
  };

  const selectAllCustomers = (customerIds: string[]) => {
    setSelectedCustomers(new Set(customerIds));
  };

  const deselectAllCustomers = () => {
    setSelectedCustomers(new Set());
  };

  useEffect(() => {
    if (!invoiceMonth || !showGenerateModal) return;

    const leasesToGenerate = leases.filter(lease => {
      const existingInvoice = invoices.find(
        inv => inv.lease_id === lease.id && inv.invoice_month === invoiceMonth
      );
      return !existingInvoice;
    });

    const customersWithBookingsIds = [...tenants, ...externalCustomers.map(ec => ({
      ...ec,
      isExternal: true
    }))].filter(customer => {
      const meetingBookings = meetingRoomBookings.filter(booking => {
        const bookingDate = new Date(booking.booking_date);
        const bookingYearMonth = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;
        const isForSelectedMonth = bookingYearMonth === invoiceMonth;
        const isUnbilled = !booking.invoice_id;
        const isCompleted = booking.status === 'completed';
        const isForCustomer = (customer as any).isExternal
          ? booking.external_customer_id === customer.id
          : booking.tenant_id === customer.id;

        if (customer.company_name?.includes('Youri')) {
          console.log('Checking Youri booking:', {
            bookingDate: booking.booking_date,
            bookingYearMonth,
            invoiceMonth,
            isForSelectedMonth,
            isUnbilled,
            isCompleted,
            status: booking.status,
            isForCustomer
          });
        }

        return isForSelectedMonth && isUnbilled && isCompleted && isForCustomer;
      });

      const flexBookings = flexDayBookings.filter(booking => {
        const bookingDate = new Date(booking.booking_date);
        const bookingYearMonth = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;
        const isForSelectedMonth = bookingYearMonth === invoiceMonth;
        const isUnbilled = !booking.invoice_id;
        const isCompleted = booking.status === 'completed';
        const isForCustomer = (customer as any).isExternal
          ? booking.external_customer_id === customer.id
          : booking.tenant_id === customer.id;
        return isForSelectedMonth && isUnbilled && isCompleted && isForCustomer;
      });

      if (customer.company_name?.includes('Youri')) {
        console.log('Youri bookings found:', {
          meetingCount: meetingBookings.length,
          flexCount: flexBookings.length,
          invoiceMonth,
          totalMeetingBookings: meetingRoomBookings.length
        });
      }

      if (meetingBookings.length === 0 && flexBookings.length === 0) return false;

      const existingDraftInvoice = invoices.find(inv => {
        const matchesCustomer = (customer as any).isExternal
          ? inv.external_customer_id === customer.id
          : inv.tenant_id === customer.id;
        return matchesCustomer && inv.invoice_month === invoiceMonth && !inv.lease_id && inv.status === 'draft';
      });

      return !existingDraftInvoice;
    }).map(c => c.id);

    setSelectedLeases(new Set(leasesToGenerate.map(l => l.id)));
    setSelectedCustomers(new Set(customersWithBookingsIds));
    setShowDetailSelection(false);
  }, [invoiceMonth, showGenerateModal, leases, invoices, tenants, externalCustomers, meetingRoomBookings, flexDayBookings]);

  const startEditInvoice = async (invoice: InvoiceWithDetails) => {
    const { data: items } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice.id);

    if (items) {
      setLineItems(items.map(item => ({
        description: item.description,
        unit_price: item.amount.toString(),
        quantity: '1',
        bookingId: item.booking_id || undefined,
        grootboek_id: item.grootboek_id || undefined,
        local_category: item.local_category || undefined
      })));
    }

    const customerType = invoice.external_customer_id ? 'external' : 'tenant';

    setFormData({
      lease_id: invoice.lease_id || '',
      tenant_id: invoice.tenant_id || '',
      external_customer_id: invoice.external_customer_id || '',
      customer_type: customerType,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      invoice_month: invoice.invoice_month || getNextMonthString(),
      vat_rate: invoice.vat_rate.toString(),
      vat_inclusive: invoice.vat_inclusive,
      reference_number: invoice.reference_number || '',
      payment_term_days: invoice.payment_term_days?.toString() || '14',
      notes: invoice.notes || ''
    });

    setInvoiceMode(invoice.lease_id ? 'lease' : 'manual');
    setEditingInvoiceId(invoice.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (invoiceMode === 'lease' && !formData.lease_id) {
      showToast('Selecteer een huurcontract', 'error');
      return;
    }

    if (invoiceMode === 'manual') {
      if (formData.customer_type === 'tenant' && !formData.tenant_id) {
        showToast('Selecteer een huurder', 'error');
        return;
      }
      if (formData.customer_type === 'external' && !formData.external_customer_id) {
        showToast('Selecteer een externe klant', 'error');
        return;
      }
    }

    const baseAmount = Math.round(lineItems.reduce((sum, item) => {
      const quantity = item.quantity ? parseFloat(item.quantity) : 1;
      const unitPrice = parseFloat(item.unit_price);
      return sum + (quantity * unitPrice);
    }, 0) * 100) / 100;

    let vatRate: number;
    let vatInclusive: boolean;

    if (invoiceMode === 'lease') {
      const selectedLease = leases.find(l => l.id === formData.lease_id);
      if (!selectedLease) return;
      vatRate = selectedLease.vat_rate;
      vatInclusive = selectedLease.vat_inclusive;
    } else {
      vatRate = parseFloat(formData.vat_rate);
      vatInclusive = formData.vat_inclusive;
    }

    const { subtotal, vatAmount, total } = calculateVAT(
      baseAmount,
      vatRate,
      vatInclusive
    );

    if (editingInvoiceId) {
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          invoice_month: formData.invoice_month || null,
          subtotal: subtotal,
          vat_amount: vatAmount,
          amount: total,
          vat_rate: vatRate,
          vat_inclusive: vatInclusive,
          reference_number: formData.reference_number || null,
          payment_term_days: parseInt(formData.payment_term_days) || 14,
          notes: formData.notes || null
        })
        .eq('id', editingInvoiceId);

      if (invoiceError) {
        console.error('Error updating invoice:', invoiceError);
        return;
      }

      await supabase
        .from('invoice_line_items')
        .delete()
        .eq('invoice_id', editingInvoiceId);

      const lineItemsToInsert = lineItems.map(item => {
        const quantity = item.quantity ? parseFloat(item.quantity) : 1;
        const unitPrice = parseFloat(item.unit_price);
        return {
          invoice_id: editingInvoiceId,
          description: item.description,
          quantity: quantity,
          unit_price: unitPrice,
          amount: quantity * unitPrice,
          booking_id: item.bookingId || null,
          local_category: item.local_category || getLocalCategory(item.space_type, item.bookingType),
          grootboek_id: item.grootboek_id || null
        };
      });

      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .insert(lineItemsToInsert);

      if (lineItemsError) {
        console.error('Error updating line items:', lineItemsError);
        return;
      }

      resetForm();

      // Refresh only the edited invoice data
      const { data: updatedInvoice } = await supabase
        .from('invoices')
        .select(`
          *,
          lease:leases(
            *,
            tenant:tenants(*),
            lease_spaces:lease_spaces(
              *,
              space:office_spaces(*)
            )
          ),
          tenant:tenants(*),
          external_customer:external_customers(*),
          line_items:invoice_line_items(*)
        `)
        .eq('id', editingInvoiceId)
        .single();

      if (updatedInvoice) {
        setInvoices(prev => prev.map(inv =>
          inv.id === editingInvoiceId ? updatedInvoice as InvoiceWithDetails : inv
        ));
      }
      return;
    } else {
      const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');

      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          lease_id: invoiceMode === 'lease' ? formData.lease_id : null,
          tenant_id: invoiceMode === 'manual' && formData.customer_type === 'tenant' ? formData.tenant_id : null,
          external_customer_id: invoiceMode === 'manual' && formData.customer_type === 'external' ? formData.external_customer_id : null,
          invoice_number: invoiceNumber,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          invoice_month: formData.invoice_month || null,
          subtotal: subtotal,
          vat_amount: vatAmount,
          amount: total,
          vat_rate: vatRate,
          vat_inclusive: vatInclusive,
          reference_number: formData.reference_number || null,
          payment_term_days: parseInt(formData.payment_term_days) || 14,
          status: 'draft',
          notes: formData.notes || null
        }])
        .select()
        .single();

      if (invoiceError) {
        console.error('Error creating invoice:', invoiceError);
        return;
      }

      const lineItemsToInsert = lineItems.map(item => {
        const quantity = item.quantity ? parseFloat(item.quantity) : 1;
        const unitPrice = parseFloat(item.unit_price);
        return {
          invoice_id: newInvoice.id,
          description: item.description,
          quantity: quantity,
          unit_price: unitPrice,
          amount: quantity * unitPrice,
          booking_id: item.bookingId || null,
          local_category: item.local_category || getLocalCategory(item.space_type, item.bookingType),
          grootboek_id: item.grootboek_id || null
        };
      });

      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .insert(lineItemsToInsert);

      if (lineItemsError) {
        console.error('Error creating line items:', lineItemsError);
        return;
      }

      const allBookingIds = lineItems
        .filter(item => item.bookingId)
        .map(item => item.bookingId);

      if (allBookingIds.length > 0) {
        // Update meeting room bookings
        const { error: meetingBookingError } = await supabase
          .from('meeting_room_bookings')
          .update({ invoice_id: newInvoice.id })
          .in('id', allBookingIds);

        if (meetingBookingError) {
          console.error('Error linking meeting room bookings to invoice:', meetingBookingError);
        }

        // Update flex day bookings
        const { error: flexBookingError } = await supabase
          .from('flex_day_bookings')
          .update({ invoice_id: newInvoice.id })
          .in('id', allBookingIds);

        if (flexBookingError) {
          console.error('Error linking flex day bookings to invoice:', flexBookingError);
        }
      }

      resetForm();

      // Add new invoice to the list with full details
      const { data: fullInvoice } = await supabase
        .from('invoices')
        .select(`
          *,
          lease:leases(
            *,
            tenant:tenants(*),
            lease_spaces:lease_spaces(
              *,
              space:office_spaces(*)
            )
          ),
          tenant:tenants(*),
          external_customer:external_customers(*),
          line_items:invoice_line_items(*)
        `)
        .eq('id', newInvoice.id)
        .single();

      if (fullInvoice) {
        setInvoices(prev => [fullInvoice as InvoiceWithDetails, ...prev]);
      }
    }
  };

  const handleLeaseSelect = async (leaseId: string) => {
    const lease = leases.find(l => l.id === leaseId);
    if (lease) {
      const items = [];

      items.push(...lease.lease_spaces.map(ls => {
          const spaceName = ls.space.space_number;
          const spaceType = ls.space.space_type;
          const squareFootageRaw = ls.space.square_footage;
          const squareFootage = typeof squareFootageRaw === 'string' ? parseFloat(squareFootageRaw) : squareFootageRaw;
          const diversenCalc = (ls.space as any).diversen_calculation;

          let displayName = spaceName;
          if (spaceType === 'bedrijfsruimte') {
            const numOnly = spaceName.replace(/^(Bedrijfsruimte|Hal)\s*/i, '').trim();
            if (/^\d+/.test(numOnly)) {
              displayName = `Hal ${numOnly}`;
            }
          }

          const isDiversenFixed = spaceType === 'diversen' && (!diversenCalc || diversenCalc === 'fixed');
          let quantity = 1;

          if (isDiversenFixed) {
            quantity = 1;
          } else if (squareFootage && !isNaN(squareFootage) && squareFootage > 0) {
            quantity = squareFootage;
          } else {
            quantity = 1;
          }

          return {
            description: displayName,
            unit_price: ls.price_per_sqm.toFixed(2),
            quantity: quantity,
            space_type: spaceType,
            local_category: getLocalCategory(spaceType)
          };
        }));

      if (lease.security_deposit > 0) {
        items.push({
          description: 'Voorschot Gas, Water & Electra',
          unit_price: lease.security_deposit.toFixed(2),
          local_category: 'diversen'
        });
      }

      setLineItems(items);
    }
    setFormData({ ...formData, lease_id: leaseId });
  };

  const updateLineItem = (index: number, field: string, value: string | number | null) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', unit_price: '0', quantity: '' }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const markAsPaid = async (invoiceId: string) => {
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoiceId);

    if (error) {
      console.error('Error updating invoice:', error);
      return;
    }

    setInvoices(prev => prev.map(inv =>
      inv.id === invoiceId
        ? { ...inv, status: 'paid' as const, paid_at: new Date().toISOString() }
        : inv
    ));
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice?.eboekhouden_factuur_id && companySettings?.eboekhouden_enabled && companySettings?.eboekhouden_connected) {
      setEBoekhoudenPaidWarning({ invoiceId, invoiceNumber: invoice.invoice_number });
      return;
    }
    setMarkingPaidId(invoiceId);
    await markAsPaid(invoiceId);
    setMarkingPaidId(null);
  };

  const confirmMarkAsPaid = async () => {
    if (!eBoekhoudenPaidWarning) return;
    const { invoiceId } = eBoekhoudenPaidWarning;
    setEBoekhoudenPaidWarning(null);
    setMarkingPaidId(invoiceId);
    await markAsPaid(invoiceId);
    setMarkingPaidId(null);
  };

  const confirmBatchMarkAsPaid = async () => {
    setEBoekhoudenBatchPaidWarning(null);
    await handleBatchStatusChange('paid', true);
  };

  const revertToDraft = async (invoiceId: string) => {
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'draft', sent_at: null })
      .eq('id', invoiceId);

    if (error) {
      console.error('Error reverting invoice to draft:', error);
      showToast('Fout bij terugzetten naar concept', 'error');
      return;
    }

    setInvoices(prev => prev.map(inv =>
      inv.id === invoiceId
        ? { ...inv, status: 'draft' as const, sent_at: null }
        : inv
    ));
    showToast('Factuur teruggezet naar concept', 'success');
  };

  const loadLogoAsBase64 = async (): Promise<string | null> => {
    try {
      const response = await fetch('/image copy copy copy copy.png');
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading logo:', error);
      return null;
    }
  };

  const sendInvoiceEmail = async (invoiceId: string) => {
    try {
      console.log('Starting sendInvoiceEmail for:', invoiceId);
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (!invoice) {
        console.error('Invoice not found');
        return;
      }
      console.log('Invoice found:', invoice);

      const tenant = getInvoiceTenant(invoice);
      console.log('Tenant:', tenant);
      if (!tenant || !tenant.email) {
        console.error('No email address found for tenant');
        return;
      }

      if (!companySettings) {
        console.error('Company settings not found');
        return;
      }
      console.log('Company settings:', companySettings);

      const { data: items } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoice.id);

      console.log('Line items:', items);

      const spaces = items?.map(item => {
        let spaceType: string = 'diversen';
        if (item.description.toLowerCase().includes('voorschot')) {
          spaceType = 'voorschot';
        } else if (item.description.startsWith('Hal ')) {
          spaceType = 'bedrijfsruimte';
        } else if (item.description.startsWith('Kantoor ')) {
          spaceType = 'kantoor';
        } else if (item.description.startsWith('Buitenterrein ')) {
          spaceType = 'buitenterrein';
        }

        let squareFootage: number | undefined = undefined;
        if (spaceType !== 'voorschot' && spaceType !== 'diversen') {
          if (item.quantity !== null && item.quantity !== undefined) {
            const parsed = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
            if (!isNaN(parsed) && parsed > 0) {
              squareFootage = parsed;
            }
          }
        }

        console.log('sendInvoiceEmail mapping:', {
          description: item.description,
          spaceType,
          quantity: item.quantity,
          quantity_type: typeof item.quantity,
          squareFootage,
          calculated_sqm: squareFootage
        });

        return {
          space_name: item.description,
          monthly_rent: item.amount,
          space_type: spaceType as any,
          square_footage: squareFootage,
          price_per_sqm: item.unit_price
        };
      }) || [];

      console.log('Final spaces array for email:', spaces);

      const invoiceData = {
        invoice_number: invoice.invoice_number,
        tenant_name: ('name' in (tenant || {}) ? tenant?.name : undefined) || undefined,
        tenant_contact_name: ('contact_name' in (tenant || {}) ? (tenant as any)?.contact_name : undefined) || undefined,
        tenant_company_name: tenant?.company_name || '',
        tenant_email: tenant?.email || '',
        tenant_phone: tenant?.phone || undefined,
        tenant_billing_address: tenant?.billing_address || undefined,
        tenant_street: tenant?.street || undefined,
        tenant_postal_code: tenant?.postal_code || undefined,
        tenant_city: tenant?.city || undefined,
        tenant_country: tenant?.country || undefined,
        invoice_month: invoice.invoice_month || undefined,
        notes: invoice.notes || undefined,
        spaces,
        security_deposit: 0,
        subtotal: invoice.subtotal,
        amount: invoice.amount,
        vat_amount: invoice.vat_amount,
        vat_rate: invoice.vat_rate,
        vat_inclusive: invoice.vat_inclusive,
        due_date: invoice.due_date,
        invoice_date: invoice.invoice_date,
        company: {
          name: companySettings.company_name,
          address: companySettings.address,
          postal_code: companySettings.postal_code,
          city: companySettings.city,
          kvk: companySettings.kvk_number,
          btw: companySettings.vat_number,
          iban: companySettings.bank_account,
          email: companySettings.email,
          phone: companySettings.phone,
          website: companySettings.website
        }
      };

      const tenantName = ('name' in tenant && tenant.name) ? tenant.name : ('contact_name' in tenant && tenant.contact_name) ? tenant.contact_name : tenant.company_name || '';
      const invoiceNumber = invoice.invoice_number.replace(/^INV-/, '');
      const formattedAmount = `\u20AC${invoice.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const emailData = {
        recipientName: tenantName,
        invoiceNumber,
        invoiceDate: new Date(invoice.invoice_date).toLocaleDateString('nl-NL'),
        dueDate: new Date(invoice.due_date).toLocaleDateString('nl-NL'),
        amount: formattedAmount,
        companySettings,
      };

      if (isEmailConfigured(companySettings)) {
        const pdfBase64 = await generateInvoicePDFBase64(invoiceData);
        const htmlBody = buildInvoiceEmailHtml(emailData);
        const textBody = buildInvoiceEmailText(emailData);

        const emailResult = await sendEmail(companySettings, {
          to: tenant.email,
          toName: tenantName,
          subject: `Factuur ${invoiceNumber} van ${companySettings.company_name}`,
          body: textBody,
          html: htmlBody,
          attachmentBase64: pdfBase64,
          attachmentName: `${invoice.invoice_number}.pdf`,
          invoiceId: invoice.id,
        });

        if (!emailResult.success) {
          throw new Error(emailResult.error || 'Fout bij verzenden van e-mail');
        }

        if (window.electronAPI && companySettings.root_folder_path && window.electronAPI.savePDF) {
          const pdf = await generateInvoicePDF(invoiceData, false, true);
          const pdfBlob = pdf.output('arraybuffer');
          const invoiceYear = new Date(invoice.invoice_date).getFullYear().toString();
          const tenantFolderPath = `${companySettings.root_folder_path}/${tenant.company_name}/${invoiceYear}`;
          const saveResult = await window.electronAPI.savePDF(pdfBlob, tenantFolderPath, `${invoice.invoice_number}.pdf`);
          if (!saveResult.success) {
            throw new Error(`E-mail verzonden, maar PDF opslaan mislukt: ${saveResult.error || 'Onbekende fout'}`);
          }
        }
      } else if (window.electronAPI) {
        const pdf = await generateInvoicePDF(invoiceData, false, true);
        const pdfBlob = pdf.output('arraybuffer');

        if (companySettings.root_folder_path && window.electronAPI.savePDF) {
          const invoiceYear = new Date(invoice.invoice_date).getFullYear().toString();
          const tenantFolderPath = `${companySettings.root_folder_path}/${tenant.company_name}/${invoiceYear}`;
          const saveResult = await window.electronAPI.savePDF(pdfBlob, tenantFolderPath, `${invoice.invoice_number}.pdf`);
          if (!saveResult.success) {
            throw new Error(`PDF opslaan mislukt: ${saveResult.error || 'Onbekende fout'}`);
          }
        }

        const textBody = buildInvoiceEmailText(emailData);
        const result = await window.electronAPI.sendEmailWithPDF(
          pdfBlob,
          tenant.email,
          `Factuur ${invoiceNumber} van ${companySettings.company_name}`,
          textBody,
          invoiceNumber,
          null
        );

        if (!result.success) {
          throw new Error(result.error || 'Fout bij openen van Outlook');
        }
      }

      if (companySettings.onedrive_enabled && companySettings.onedrive_user_email &&
          companySettings.graph_tenant_id && companySettings.graph_client_id && companySettings.graph_client_secret) {
        try {
          const pdfBase64 = await generateInvoicePDFBase64(invoiceData);
          const invoiceDate = new Date(invoice.invoice_date);
          const year = invoiceDate.getFullYear().toString();
          const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
          const basePath = companySettings.onedrive_folder_path || 'Facturen';
          const folderPath = `${basePath}/${year}/${month}`;
          const customerName = (tenant.company_name || '').replace(/[<>:"/\\|?*]/g, '_').trim();
          const fileName = customerName
            ? `${invoice.invoice_number}_${customerName}.pdf`
            : `${invoice.invoice_number}.pdf`;

          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

          const response = await fetch(`${supabaseUrl}/functions/v1/onedrive-upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              action: 'upload',
              graph: {
                tenant_id: companySettings.graph_tenant_id,
                client_id: companySettings.graph_client_id,
                client_secret: companySettings.graph_client_secret,
              },
              user_email: companySettings.onedrive_user_email,
              folder_path: folderPath,
              file_name: fileName,
              file_content_base64: pdfBase64,
            }),
          });

          const result = await response.json();
          if (result.success) {
            console.log('Invoice uploaded to OneDrive:', result.webUrl);
          } else {
            console.error('OneDrive upload failed:', result.error);
          }
        } catch (onedriveErr) {
          console.error('OneDrive upload error:', onedriveErr);
        }
      }

      const { error } = await supabase
        .from('invoices')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', invoiceId);

      if (error) {
        console.error('Error updating invoice status:', error);
        return;
      }

      setInvoices(prev => prev.map(inv =>
        inv.id === invoiceId
          ? { ...inv, status: 'sent' as const, sent_at: new Date().toISOString() }
          : inv
      ));

      if (companySettings.eboekhouden_api_token && companySettings.eboekhouden_connected) {
        const customerType = invoice.external_customer ? 'external' as const : 'tenant' as const;
        const invoiceWithItems = { ...invoice, line_items: items || [] };
        syncInvoiceToEBoekhouden(
          companySettings.eboekhouden_api_token,
          invoiceWithItems as any,
          tenant as any,
          customerType,
          companySettings
        ).then(syncResult => {
          if (syncResult.success) {
            setInvoices(prev => prev.map(inv => {
              if (inv.id !== invoiceId) return inv;
              return { ...inv, eboekhouden_factuur_id: 'synced', eboekhouden_synced_at: new Date().toISOString() } as any;
            }));
          }
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Error sending invoice:', error);
      showToast(error instanceof Error ? error.message : 'Fout bij verzenden van factuur', 'error');
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    const correctCode = companySettings?.delete_code || '1234';
    if (deletePassword !== correctCode) {
      setDeleteError('Onjuiste code. Probeer opnieuw.');
      setDeletePassword('');
      return;
    }

    if (invoiceId === 'bulk') {
      const idsToDelete = Array.from(selectedInvoices);

      for (const id of idsToDelete) {
        const { error: itemsError } = await supabase
          .from('invoice_line_items')
          .delete()
          .eq('invoice_id', id);

        if (itemsError) {
          console.error('Error deleting line items:', itemsError);
          setDeleteError('Fout bij verwijderen van factuurregels');
          return;
        }

        const { error } = await supabase
          .from('invoices')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting invoice:', error);
          setDeleteError('Fout bij verwijderen van factuur');
          return;
        }
      }

      setShowDeleteConfirm(null);
      setDeletePassword('');
      setDeleteError('');
      setInvoices(prev => prev.filter(inv => !selectedInvoices.has(inv.id)));
      setSelectedInvoices(new Set());
    } else {
      const { error: itemsError } = await supabase
        .from('invoice_line_items')
        .delete()
        .eq('invoice_id', invoiceId);

      if (itemsError) {
        console.error('Error deleting line items:', itemsError);
        setDeleteError('Fout bij verwijderen van factuurregels');
        return;
      }

      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) {
        console.error('Error deleting invoice:', error);
        setDeleteError('Fout bij verwijderen van factuur');
        return;
      }
      setShowDeleteConfirm(null);
      setDeletePassword('');
      setDeleteError('');

      // Update local state without full reload
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
    }
  };

  const viewInvoiceDetails = async (invoice: InvoiceWithDetails) => {
    let items = (invoice as any).line_items;

    if (!items || items.length === 0) {
      const { data } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoice.id);
      items = data;
    }

    const spaces = convertLineItemsToSpaces(items || []);
    setPreviewInvoice({ invoice: { ...invoice, line_items: items } as any, spaces });
  };

  const resetForm = () => {
    setFormData({
      lease_id: '',
      tenant_id: '',
      external_customer_id: '',
      customer_type: 'tenant',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      invoice_month: getNextMonthString(),
      vat_rate: '21',
      vat_inclusive: false,
      reference_number: '',
      payment_term_days: '14',
      notes: ''
    });
    setLineItems([]);
    setShowForm(false);
    setInvoiceMode('lease');
    setEditingInvoiceId(null);
  };

  const generateMeetingRoomInvoices = async () => {
    if (selectedCustomers.size === 0) {
      showToast('Selecteer eerst de klanten waarvoor je facturen wilt genereren.', 'error');
      return;
    }

    setGeneratingBulk(true);

    const { data: settings } = await supabase
      .from('company_settings')
      .select('test_mode, test_date')
      .maybeSingle();

    let currentDate = new Date();
    if (settings?.test_mode === true && settings?.test_date) {
      currentDate = new Date(settings.test_date);
    }

    const targetMonth = invoiceMonth || await getNextMonthString();

    console.log('=== MEETING ROOM INVOICE GENERATION ===');
    console.log('Generating meeting room invoices for month:', targetMonth);
    console.log('Current date:', currentDate.toISOString());
    console.log('Selected customers:', selectedCustomers.size);
    console.log('Test mode:', settings?.test_mode);

    const invoiceDate = currentDate.toISOString().split('T')[0];
    const dueDateObj = new Date(currentDate);
    dueDateObj.setDate(dueDateObj.getDate() + 14);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    const customersWithBookings = new Map<string, { customer: any; customerType: 'tenant' | 'external'; bookings: any[] }>();

    for (const tenant of tenants.filter(t => selectedCustomers.has(t.id))) {
      console.log('Checking tenant:', tenant.company_name, 'ID:', tenant.id);
      const bookingItems = await fetchMeetingRoomBookingsForMonth(tenant.id, targetMonth, 'tenant');
      console.log('Found bookings:', bookingItems.length, 'for tenant:', tenant.company_name);

      if (bookingItems.length > 0) {
        customersWithBookings.set(`tenant-${tenant.id}`, {
          customer: tenant,
          customerType: 'tenant',
          bookings: bookingItems
        });
      }
    }

    const { data: externalCustomers } = await supabase
      .from('external_customers')
      .select('*');

    const selectedExternalCustomers = (externalCustomers || []).filter(c => selectedCustomers.has(c.id));
    console.log('Selected external customers:', selectedExternalCustomers.length);

    for (const customer of selectedExternalCustomers) {
      console.log('Checking external customer:', customer.company_name, 'ID:', customer.id);
      const bookingItems = await fetchMeetingRoomBookingsForMonth(customer.id, targetMonth, 'external');
      console.log('Found bookings:', bookingItems.length, 'for external customer:', customer.company_name);

      if (bookingItems.length > 0) {
        customersWithBookings.set(`external-${customer.id}`, {
          customer,
          customerType: 'external',
          bookings: bookingItems
        });
      }
    }

    console.log('Total customers with bookings:', customersWithBookings.size);
    console.log('Starting invoice creation...');

    let successCount = 0;
    let failCount = 0;

    for (const [key, { customer, customerType, bookings }] of customersWithBookings) {
      try {
        console.log('Processing customer:', customer.company_name, 'type:', customerType);

        let existingInvoice;
        if (customerType === 'tenant') {
          existingInvoice = invoices.find(
            inv => inv.tenant_id === customer.id && inv.invoice_month === targetMonth && inv.lease_id === null
          );
        } else {
          existingInvoice = invoices.find(
            inv => inv.external_customer_id === customer.id && inv.invoice_month === targetMonth && inv.lease_id === null
          );
        }

        if (existingInvoice) {
          console.log('Invoice already exists for customer:', customer.company_name);
          failCount++;
          continue;
        }

        const totalBeforeDiscount = Math.round(bookings.reduce((sum, booking) => {
          const beforeDiscount = (booking.total_amount || 0) + (booking.discount_amount || 0);
          return sum + beforeDiscount;
        }, 0) * 100) / 100;

        const totalDiscount = Math.round(bookings.reduce((sum, booking) => {
          return sum + (booking.discount_amount || 0);
        }, 0) * 100) / 100;

        let additionalDiscount = 0;
        const discountPercentage = customerType === 'tenant'
          ? (customer as Tenant).meeting_discount_percentage
          : (customer as ExternalCustomer).meeting_discount_percentage;

        if (discountPercentage && discountPercentage > 0) {
          additionalDiscount = Math.round((totalBeforeDiscount - totalDiscount) * (discountPercentage / 100) * 100) / 100;
        }

        const baseAmount = totalBeforeDiscount - totalDiscount - additionalDiscount;

        const { subtotal, vatAmount, total } = calculateVAT(baseAmount, 21, false);

        const notesLines = ['Vergaderruimte boekingen:'];
        bookings.forEach(booking => {
          let rateDescription = '';
          if (booking.rate_type === 'half_day') {
            rateDescription = 'dagdeel';
          } else if (booking.rate_type === 'full_day') {
            rateDescription = 'hele dag';
          } else {
            rateDescription = `${Math.round(booking.total_hours)}u`;
          }

          const beforeDiscountAmount = (booking.total_amount || 0) + (booking.discount_amount || 0);
          const startTime = booking.start_time?.substring(0, 5) || '--:--';
          const endTime = booking.end_time?.substring(0, 5) || '--:--';
          const bookingLine = `- ${booking.space?.space_number || 'Vergaderruimte'} - ${new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${startTime}-${endTime} (${rateDescription}) = €${beforeDiscountAmount.toFixed(2)}`;
          notesLines.push(bookingLine);
        });

        if (totalDiscount > 0 && bookings.length > 0 && bookings[0].discount_percentage) {
          notesLines.push(`- Totale korting ${Math.round(bookings[0].discount_percentage)}% huurderkorting = €${totalDiscount.toFixed(2)}`);
        }

        if (additionalDiscount > 0 && discountPercentage) {
          notesLines.push(`- Korting vergaderruimtes (${discountPercentage}%) = €${additionalDiscount.toFixed(2)}`);
        }

        const invoiceNotes = notesLines.join('\n');

        console.log('Calculated amounts:', { baseAmount, subtotal, vatAmount, total });

        const { data: invoiceNumber, error: invoiceNumberError } = await supabase.rpc('generate_invoice_number');

        if (invoiceNumberError) {
          console.error('Error generating invoice number:', invoiceNumberError);
          failCount++;
          continue;
        }

        console.log('Generated invoice number:', invoiceNumber);

        const invoiceData: any = {
          lease_id: null,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          invoice_month: targetMonth,
          subtotal: subtotal,
          vat_amount: vatAmount,
          amount: total,
          vat_rate: 21,
          vat_inclusive: false,
          status: 'draft',
          notes: invoiceNotes
        };

        if (customerType === 'tenant') {
          invoiceData.tenant_id = customer.id;
        } else {
          invoiceData.external_customer_id = customer.id;
        }

        const { data: newInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert([invoiceData])
          .select()
          .single();

        if (invoiceError) {
          console.error('Error creating meeting room invoice:', invoiceError);
          failCount++;
          continue;
        }

        const lineItemsToInsert = bookings.flatMap(booking => {
          let rateDescription = '';
          if (booking.rate_type === 'half_day') {
            rateDescription = 'halve dag';
          } else if (booking.rate_type === 'full_day') {
            rateDescription = 'hele dag';
          } else {
            rateDescription = `${booking.total_hours}u`;
          }

          const startTime = booking.start_time?.substring(0, 5) || '--:--';
          const endTime = booking.end_time?.substring(0, 5) || '--:--';
          const description = `${booking.space?.space_number || 'Vergaderruimte'} - ${new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${startTime}-${endTime} (${rateDescription})`;

          const beforeDiscountAmount = (booking.total_amount || 0) + (booking.discount_amount || 0);

          const items: any[] = [{
            invoice_id: newInvoice.id,
            description: description,
            quantity: booking.total_hours,
            unit_price: booking.applied_rate || booking.hourly_rate,
            amount: beforeDiscountAmount,
            booking_id: booking.id,
            local_category: 'vergaderruimte'
          }];

          if (booking.discount_percentage && booking.discount_percentage > 0 && booking.discount_amount && booking.discount_amount > 0) {
            items.push({
              invoice_id: newInvoice.id,
              description: `Korting ${booking.discount_percentage}% op ${booking.space?.space_number || 'vergaderruimte'}`,
              quantity: 1,
              unit_price: -(booking.discount_amount),
              amount: -(booking.discount_amount),
              booking_id: null,
              local_category: 'vergaderruimte'
            });
          }

          return items;
        });

        if (additionalDiscount > 0 && discountPercentage) {
          lineItemsToInsert.push({
            invoice_id: newInvoice.id,
            description: `Korting vergaderruimtes (${discountPercentage}%)`,
            quantity: 1,
            unit_price: -additionalDiscount,
            amount: -additionalDiscount,
            booking_id: null,
            local_category: 'vergaderruimte'
          });
        }

        const { error: lineItemsError } = await supabase
          .from('invoice_line_items')
          .insert(lineItemsToInsert);

        if (lineItemsError) {
          console.error('Error creating line items:', lineItemsError);
          await supabase.from('invoices').delete().eq('id', newInvoice.id);
          failCount++;
          continue;
        }

        const allBookingIds = bookings.map(booking => booking.id);

        if (allBookingIds.length > 0) {
          await supabase
            .from('meeting_room_bookings')
            .update({ invoice_id: newInvoice.id })
            .in('id', allBookingIds);

          await supabase
            .from('flex_day_bookings')
            .update({ invoice_id: newInvoice.id })
            .in('id', allBookingIds);
        }

        successCount++;

        const { data: fullInvoice } = await supabase
          .from('invoices')
          .select(`
            *,
            lease:leases(
              *,
              tenant:tenants(*),
              lease_spaces:lease_spaces(
                *,
                space:office_spaces(*)
              )
            ),
            tenant:tenants(*),
            external_customer:external_customers(*),
            line_items:invoice_line_items(*)
          `)
          .eq('id', newInvoice.id)
          .single();

        if (fullInvoice) {
          setInvoices(prev => [fullInvoice as InvoiceWithDetails, ...prev]);
        }

        console.log('Successfully created invoice for customer:', customer.company_name);
      } catch (err: any) {
        console.error('Error generating meeting room invoice:', err);
        if (err?.message?.includes('duplicate') || err?.code === '23505') {
          console.log('Skipped - duplicate invoice for customer:', customer.company_name);
        } else {
          console.error('Unexpected error for customer:', customer.company_name, err);
        }
        failCount++;
      }
    }

    setGeneratingBulk(false);

    console.log('=== GENERATION COMPLETE ===');
    console.log(`Success: ${successCount}, Failed: ${failCount}`);

    if (successCount > 0) {
      await loadData();
      console.log(`✓ ${successCount} vergaderruimte ${successCount > 1 ? 'facturen' : 'factuur'} aangemaakt voor ${new Date(targetMonth + '-01').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}`);
      setSelectedCustomers(new Set());
    }
    if (failCount > 0) {
      console.log(`${failCount} facturen overgeslagen (bestaan al of fout)`);
    }
  };

  const generateBulkInvoices = async () => {
    if (selectedLeases.size === 0) {
      showToast('Selecteer eerst de huurcontracten waarvoor je facturen wilt genereren.', 'error');
      return;
    }

    setGeneratingBulk(true);

    const { data: settings } = await supabase
      .from('company_settings')
      .select('test_mode, test_date')
      .maybeSingle();

    let currentDate = new Date();
    if (settings?.test_mode === true && settings?.test_date) {
      currentDate = new Date(settings.test_date);
    }

    const targetMonth = invoiceMonth || await getNextMonthString();
    const invoiceDate = currentDate.toISOString().split('T')[0];
    const dueDateObj = new Date(currentDate);
    dueDateObj.setDate(dueDateObj.getDate() + 14);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    const leasesToProcess = leases.filter(l => selectedLeases.has(l.id));

    console.log('Starting bulk invoice generation for month:', targetMonth);
    console.log('Total leases to process:', leasesToProcess.length);
    console.log('Leases:', leasesToProcess.map(l => ({ id: l.id, tenant: l.tenant?.company_name })));

    let successCount = 0;
    let failCount = 0;

    for (const lease of leasesToProcess) {
      try {
        console.log('Processing lease:', lease.id, 'Tenant:', lease.tenant?.company_name);

        const existingInvoice = invoices.find(
          inv => inv.lease_id === lease.id && inv.invoice_month === targetMonth
        );

        if (existingInvoice) {
          console.log('Skipping - invoice already exists for', lease.tenant?.company_name, 'month:', targetMonth);
          continue;
        }

        console.log('Creating invoice for', lease.tenant?.company_name, 'for month:', targetMonth);

        const { data: invoiceNumber, error: numberError } = await supabase.rpc('generate_invoice_number');

        if (numberError || !invoiceNumber) {
          console.error('Error generating invoice number:', numberError);
          failCount++;
          continue;
        }

        console.log('Generated invoice number:', invoiceNumber);

        let rentAmount = 0;
        const lineItemsToInsert = [];

        if (lease.lease_type === 'flex') {
          if (lease.flex_pricing_model === 'monthly_unlimited') {
            rentAmount = lease.flex_monthly_rate || 0;
            lineItemsToInsert.push({
              invoice_id: '',
              description: 'Flexplek - Maandelijks tarief (onbeperkt)',
              quantity: 1,
              unit_price: rentAmount,
              amount: rentAmount,
              local_category: 'flexplek'
            });
          } else if (lease.flex_pricing_model === 'daily') {
            const [year, month] = targetMonth.split('-').map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();
            const workingDays = Math.round(daysInMonth * (5/7));
            rentAmount = (lease.flex_daily_rate || 0) * workingDays;
            lineItemsToInsert.push({
              invoice_id: '',
              description: `Flexplek - Dagelijks tarief (${workingDays} werkdagen)`,
              quantity: workingDays,
              unit_price: lease.flex_daily_rate || 0,
              amount: rentAmount,
              quantity_label: 'dagen',
              local_category: 'flexplek'
            });
          } else if (lease.flex_pricing_model === 'credit_based') {
            const creditsPerWeek = (lease as any).credits_per_week || 0;
            const weeksInMonth = 4.33;
            const monthlyCredits = Math.round(creditsPerWeek * weeksInMonth);
            rentAmount = monthlyCredits * (lease.flex_credit_rate || 0);
            lineItemsToInsert.push({
              invoice_id: '',
              description: `Flexplek - ${creditsPerWeek} ${lease.flex_day_type === 'half_day' ? 'halve ' : ''}dagen/week`,
              quantity: monthlyCredits,
              unit_price: lease.flex_credit_rate || 0,
              amount: rentAmount,
              quantity_label: 'dagen',
              local_category: 'flexplek'
            });
          }
        } else {
          rentAmount = lease.lease_spaces.reduce((sum, ls) => {
            const monthlyRent = typeof ls.monthly_rent === 'string' ? parseFloat(ls.monthly_rent) : ls.monthly_rent;
            return sum + monthlyRent;
          }, 0);
        }

        const vatRate = typeof lease.vat_rate === 'string' ? parseFloat(lease.vat_rate) : lease.vat_rate;
        const securityDeposit = typeof lease.security_deposit === 'string' ? parseFloat(lease.security_deposit) : lease.security_deposit;
        const discountPercentage = lease.tenant?.lease_discount_percentage
          ? (typeof lease.tenant.lease_discount_percentage === 'string'
              ? parseFloat(lease.tenant.lease_discount_percentage)
              : lease.tenant.lease_discount_percentage)
          : 0;

        let discountAmount = 0;
        if (discountPercentage > 0) {
          discountAmount = Math.round(rentAmount * (discountPercentage / 100) * 100) / 100;
        }

        console.log('=== INVOICE CALCULATION DEBUG ===');
        console.log('Tenant:', lease.tenant?.company_name);
        console.log('Rent amount:', rentAmount);
        console.log('Discount %:', discountPercentage);
        console.log('Discount amount:', discountAmount);
        console.log('Security deposit:', securityDeposit);
        console.log('VAT rate:', vatRate);
        console.log('VAT inclusive:', lease.vat_inclusive);

        const baseAmount = Math.round((rentAmount - discountAmount + securityDeposit) * 100) / 100;

        const { subtotal, vatAmount, total } = calculateVAT(
          baseAmount,
          vatRate,
          lease.vat_inclusive
        );

        const { data: newInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert([{
            lease_id: lease.id,
            tenant_id: lease.tenant_id,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            due_date: dueDate,
            invoice_month: targetMonth,
            subtotal: subtotal,
            vat_amount: vatAmount,
            amount: total,
            vat_rate: vatRate,
            vat_inclusive: lease.vat_inclusive,
            status: 'draft',
            notes: null
          }])
          .select()
          .single();

        if (invoiceError) {
          console.error('Error creating invoice:', invoiceError);
          failCount++;
          continue;
        }

        if (lease.lease_type !== 'flex') {
          for (const ls of lease.lease_spaces) {
            const spaceName = ls.space.space_number;
            const spaceType = ls.space.space_type;
            const squareFootage = typeof ls.space.square_footage === 'string' ? parseFloat(ls.space.square_footage) : ls.space.square_footage;
            const diversenCalc = (ls.space as any).diversen_calculation;
            const pricePerSqm = typeof ls.price_per_sqm === 'string' ? parseFloat(ls.price_per_sqm) : ls.price_per_sqm;
            const monthlyRent = typeof ls.monthly_rent === 'string' ? parseFloat(ls.monthly_rent) : ls.monthly_rent;

            console.log('Processing lease space:', {
              spaceName,
              spaceType,
              squareFootage,
              diversenCalc,
              pricePerSqm,
              monthlyRent,
              square_footage_raw: ls.space.square_footage
            });

            let displayName = spaceName;
            if (spaceType === 'bedrijfsruimte') {
              const numOnly = spaceName.replace(/^(Bedrijfsruimte|Hal)\s*/i, '').trim();
              if (/^\d+/.test(numOnly)) {
                displayName = `Hal ${numOnly}`;
              }
            }

            const isDiversenFixed = spaceType === 'diversen' && (!diversenCalc || diversenCalc === 'fixed');
            let quantity = 1;

            if (isDiversenFixed) {
              quantity = 1;
            } else if (squareFootage && !isNaN(squareFootage) && squareFootage > 0) {
              quantity = squareFootage;
            } else {
              quantity = 1;
              console.warn('Square footage is invalid for', spaceName, '- using quantity 1');
            }

            console.log('Final quantity for', displayName, ':', quantity);

            lineItemsToInsert.push({
              invoice_id: newInvoice.id,
              description: displayName,
              quantity: quantity,
              unit_price: pricePerSqm,
              amount: monthlyRent,
              local_category: getLocalCategory(spaceType)
            });
          }
        } else {
          lineItemsToInsert.forEach(item => {
            item.invoice_id = newInvoice.id;
          });
        }

        if (discountAmount > 0) {
          lineItemsToInsert.push({
            invoice_id: newInvoice.id,
            description: `Korting verhuur (${discountPercentage}%)`,
            quantity: 1,
            unit_price: -discountAmount,
            amount: -discountAmount,
            local_category: null
          });
        }

        if (securityDeposit > 0) {
          lineItemsToInsert.push({
            invoice_id: newInvoice.id,
            description: 'Voorschot Gas, Water & Electra',
            quantity: 1,
            unit_price: securityDeposit,
            amount: securityDeposit,
            local_category: 'diversen'
          });
        }

        const { error: lineItemsError } = await supabase
          .from('invoice_line_items')
          .insert(lineItemsToInsert);

        if (lineItemsError) {
          console.error('Error creating line items:', lineItemsError);
          await supabase.from('invoices').delete().eq('id', newInvoice.id);
          failCount++;
        } else {
          successCount++;

          // Add new invoice to local state immediately
          const { data: fullInvoice } = await supabase
            .from('invoices')
            .select(`
              *,
              lease:leases(
                *,
                tenant:tenants(*),
                lease_spaces:lease_spaces(
                  *,
                  space:office_spaces(*)
                )
              ),
              tenant:tenants(*),
              external_customer:external_customers(*),
              line_items:invoice_line_items(*)
            `)
            .eq('id', newInvoice.id)
            .single();

          if (fullInvoice) {
            setInvoices(prev => [fullInvoice as InvoiceWithDetails, ...prev]);
          }
        }
      } catch (error: any) {
        console.error('Error processing lease:', error);
        if (error?.message?.includes('duplicate') || error?.code === '23505') {
          console.log('Skipped - duplicate invoice for lease:', lease.id);
        } else {
          console.error('Unexpected error for lease:', lease.id, error);
        }
        failCount++;
      }
    }

    setGeneratingBulk(false);

    if (failCount > 0) {
      console.log(`${failCount} facturen overgeslagen (bestaan al of fout)`);
    }

    return successCount;
  };

  const generateAllInvoices = async () => {
    console.log('\n\n========================================');
    console.log('GENERATE ALL INVOICES CALLED');
    console.log('========================================');
    console.log('Selected leases:', selectedLeases.size);
    console.log('Selected customers:', selectedCustomers.size);
    console.log('Invoice month:', invoiceMonth);
    console.log('========================================\n');

    if (selectedLeases.size === 0 && selectedCustomers.size === 0) {
      showToast('Selecteer eerst de huurcontracten en/of klanten waarvoor je facturen wilt genereren.', 'error');
      return;
    }

    console.log('Starting invoice generation...');

    let totalSuccess = 0;

    if (selectedLeases.size > 0) {
      const leaseSuccess = await generateBulkInvoices();
      totalSuccess += leaseSuccess || 0;
    }

    if (selectedCustomers.size > 0) {
      await generateMeetingRoomInvoicesForSelectedCustomers();
    } else if (totalSuccess > 0) {
      await refreshInvoices();
      setShowGenerateModal(false);
      setInvoiceMonth('');
      setSelectedLeases(new Set());
      setSelectedCustomers(new Set());
      setShowDetailSelection(true);
      showToast(`${totalSuccess} factuur${totalSuccess !== 1 ? 'uren' : ''} succesvol aangemaakt!`, 'success');
    }
  };

  const generateMeetingRoomInvoicesForSelectedCustomers = async () => {
    console.log('🟢 generateMeetingRoomInvoicesForSelectedCustomers CALLED');
    console.log('Selected customers:', Array.from(selectedCustomers));
    console.log('Invoice month:', invoiceMonth);

    setGeneratingBulk(true);

    let meetingSuccess = 0;
    let meetingFail = 0;

    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .maybeSingle();

    let currentDate = new Date();
    if (settings?.test_mode === true && settings?.test_date) {
      currentDate = new Date(settings.test_date);
    }

    const targetMonth = invoiceMonth || await getNextMonthString();
    console.log('Target month:', targetMonth);

    const selectedCustomersArray = Array.from(selectedCustomers);
    console.log('Processing customers:', selectedCustomersArray.length);
    for (const customerId of selectedCustomersArray) {
      console.log('🔵 Processing customer:', customerId);
      const customer = [...tenants, ...externalCustomers].find(c => c.id === customerId);
      if (!customer) {
        console.log('❌ Customer not found:', customerId);
        continue;
      }

      console.log('✅ Customer found:', customer.company_name || customer.name);

        const isExternal = externalCustomers.some(ec => ec.id === customerId);
        console.log('Is external:', isExternal);

        const existingBookingInvoice = invoices.find(inv => {
          const matchesCustomer = isExternal
            ? inv.external_customer_id === customerId
            : inv.tenant_id === customerId;
          if (!matchesCustomer || inv.invoice_month !== targetMonth || inv.lease_id) return false;
          const hasLinkedBookings = meetingRoomBookings.some(b => b.invoice_id === inv.id) ||
            flexDayBookings.some(b => b.invoice_id === inv.id);
          return hasLinkedBookings;
        });

        if (existingBookingInvoice) {
          console.log(`⚠️ Skipping: booking invoice already exists for customer ${customer.company_name || customer.name} for month ${targetMonth}`);
          meetingFail++;
          continue;
        }

        console.log('No existing invoice, fetching bookings...');

        try {
          const bookings = await fetchMeetingRoomBookingsForMonth(
            customerId,
            targetMonth,
            isExternal ? 'external' : 'tenant'
          );

          console.log('📋 Bookings found:', bookings.length);

          if (bookings.length === 0) {
            console.log('⚠️ No bookings found for customer');
            meetingFail++;
            continue;
          }

          const { data: invoiceNumber, error: invoiceNumberError } = await supabase.rpc('generate_invoice_number');

          if (invoiceNumberError || !invoiceNumber) {
            console.error('Error generating invoice number:', invoiceNumberError);
            meetingFail++;
            continue;
          }

          const customerDiscountPercentage = isExternal
            ? (customer as any).meeting_discount_percentage || 0
            : (customer as any).meeting_discount_percentage || 0;

          let totalBeforeDiscount = 0;
          let totalDiscountAmount = 0;

          bookings.forEach(booking => {
            const bookingAmount = booking.total_amount || 0;
            const bookingDiscount = booking.discount_amount || 0;
            const beforeDiscount = bookingAmount + bookingDiscount;
            totalBeforeDiscount += beforeDiscount;
            totalDiscountAmount += bookingDiscount;
          });

          if (customerDiscountPercentage > 0 && totalDiscountAmount === 0) {
            totalDiscountAmount = Math.round(totalBeforeDiscount * (customerDiscountPercentage / 100) * 100) / 100;
          }

          const finalAmount = totalBeforeDiscount - totalDiscountAmount;
          const { subtotal, vatAmount, total } = calculateVAT(finalAmount, 21, false);

          const hasMeetingBookings = bookings.some(b => b.booking_type === 'meeting_room');
          const hasFlexBookings = bookings.some(b => b.booking_type === 'flex');
          let notesHeader = 'Vergaderruimte boekingen:';
          if (hasFlexBookings && !hasMeetingBookings) {
            notesHeader = 'Flex werkplek boekingen:';
          } else if (hasFlexBookings && hasMeetingBookings) {
            notesHeader = 'Vergaderruimte & Flex werkplek boekingen:';
          }

          const notesLines = [notesHeader];
          bookings.forEach(booking => {
            let rateDescription = '';
            if (booking.booking_type === 'flex') {
              if (booking.is_half_day) {
                rateDescription = 'dagdeel';
              } else if (booking.total_hours > 0 && booking.total_hours < 8) {
                rateDescription = `${Math.round(booking.total_hours)}u`;
              } else {
                rateDescription = 'hele dag';
              }
            } else {
              if (booking.rate_type === 'half_day') {
                rateDescription = 'dagdeel';
              } else if (booking.rate_type === 'full_day') {
                rateDescription = 'hele dag';
              } else {
                rateDescription = `${Math.round(booking.total_hours)}u`;
              }
            }

            const defaultLabel = booking.booking_type === 'flex' ? 'Flexplek' : 'Vergaderruimte';
            const bookingAmount = booking.total_amount || 0;
            const bookingDiscount = booking.discount_amount || 0;
            const beforeDiscountAmount = bookingAmount + bookingDiscount;
            const startTime = booking.start_time?.substring(0, 5) || '--:--';
            const endTime = booking.end_time?.substring(0, 5) || '--:--';
            const bookingLine = `- ${booking.space?.space_number || defaultLabel} - ${new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${startTime}-${endTime} (${rateDescription}) = €${beforeDiscountAmount.toFixed(2)}`;
            notesLines.push(bookingLine);
          });

          if (totalDiscountAmount > 0 && customerDiscountPercentage > 0) {
            notesLines.push(`- Totale korting ${Math.round(customerDiscountPercentage)}% huurderkorting = €${totalDiscountAmount.toFixed(2)}`);
          }

          const invoiceNotes = notesLines.join('\n');

          const { data: newInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert({
              invoice_number: invoiceNumber,
              tenant_id: isExternal ? null : customerId,
              external_customer_id: isExternal ? customerId : null,
              invoice_date: currentDate.toISOString().split('T')[0],
              due_date: new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              subtotal: subtotal,
              vat_amount: vatAmount,
              amount: total,
              vat_rate: 21,
              vat_inclusive: false,
              status: 'draft',
              invoice_month: targetMonth,
              notes: invoiceNotes
            })
            .select()
            .single();

          if (invoiceError || !newInvoice) {
            console.error('Error creating meeting room invoice:', invoiceError);
            meetingFail++;
            continue;
          }

          const lineItems = bookings.map(booking => {
            const bookingAmount = booking.total_amount || 0;
            const bookingDiscount = booking.discount_amount || 0;
            const beforeDiscountAmount = bookingAmount + bookingDiscount;
            const defaultLabel = booking.booking_type === 'flex' ? 'Flexplek' : 'Vergaderruimte';
            const category = booking.booking_type === 'flex' ? 'flexplek' : 'vergaderruimte';

            return {
              invoice_id: newInvoice.id,
              description: `${booking.space?.space_number || defaultLabel} - ${new Date(booking.booking_date).toLocaleDateString('nl-NL')} ${booking.start_time}-${booking.end_time}`,
              quantity: booking.total_hours,
              unit_price: booking.hourly_rate,
              amount: beforeDiscountAmount,
              booking_id: booking.booking_type === 'meeting_room' ? booking.id : null,
              local_category: category
            };
          });

          if (totalDiscountAmount > 0 && customerDiscountPercentage > 0) {
            const spaceName = bookings.length === 1
              ? bookings[0].space?.space_number || 'Vergaderruimte'
              : 'Boekingen';
            lineItems.push({
              invoice_id: newInvoice.id,
              description: `Korting ${Math.round(customerDiscountPercentage)}% op ${spaceName}`,
              quantity: 1,
              unit_price: -totalDiscountAmount,
              amount: -totalDiscountAmount,
              booking_id: null,
              local_category: null as any
            });
          }

          const { error: lineItemsError } = await supabase
            .from('invoice_line_items')
            .insert(lineItems);

          if (lineItemsError) {
            console.error('Error creating line items:', lineItemsError);
            await supabase.from('invoices').delete().eq('id', newInvoice.id);
            meetingFail++;
            continue;
          }

          const meetingBookingIds = bookings.filter(b => b.booking_type === 'meeting_room').map(b => b.id);
          const flexBookingIds = bookings.filter(b => b.booking_type === 'flex').map(b => b.id);

          if (meetingBookingIds.length > 0) {
            await supabase
              .from('meeting_room_bookings')
              .update({ invoice_id: newInvoice.id })
              .in('id', meetingBookingIds);
          }

          if (flexBookingIds.length > 0) {
            await supabase
              .from('flex_day_bookings')
              .update({ invoice_id: newInvoice.id })
              .in('id', flexBookingIds);
          }

          meetingSuccess++;
        } catch (err) {
          console.error('Unexpected error generating meeting room invoice:', err);
          meetingFail++;
        }
      }

    setGeneratingBulk(false);

    console.log('🏁 FINISHED');
    console.log('✅ Success:', meetingSuccess);
    console.log('❌ Failed:', meetingFail);

    if (meetingSuccess > 0) {
      await refreshInvoices();
      setShowGenerateModal(false);
      setInvoiceMonth('');
      setSelectedLeases(new Set());
      setSelectedCustomers(new Set());
      setShowDetailSelection(true);
      showToast(`${meetingSuccess} factuur${meetingSuccess !== 1 ? 'uren' : ''} succesvol aangemaakt!`, 'success');
    } else {
      showToast(`Geen facturen aangemaakt. ${meetingFail} facturen overgeslagen (bestaan al, geen boekingen, of fout).`, 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-900 text-green-400';
      case 'sent': return 'bg-dark-700 text-gold-400';
      case 'overdue': return 'bg-red-900 text-red-400';
      case 'concept':
      case 'draft': return 'bg-blue-900 text-blue-400';
      default: return 'bg-dark-700 text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'BETAALD';
      case 'sent': return 'VERZONDEN';
      case 'overdue': return 'ACHTERSTALLIG';
      case 'draft': return 'CONCEPT';
      default: return status.toUpperCase();
    }
  };

  const getTotalAmount = () => {
    const baseAmount = lineItems.reduce((sum, item) => {
      const quantity = item.quantity ? parseFloat(item.quantity) : 1;
      const unitPrice = parseFloat(item.unit_price || '0');
      return sum + (quantity * unitPrice);
    }, 0);

    let vatRate: number;
    let vatInclusive: boolean;

    if (invoiceMode === 'lease') {
      const selectedLease = leases.find(l => l.id === formData.lease_id);
      if (!selectedLease) return { subtotal: 0, vatAmount: 0, total: 0 };
      vatRate = selectedLease.vat_rate;
      vatInclusive = selectedLease.vat_inclusive;
    } else {
      vatRate = parseFloat(formData.vat_rate || '21');
      vatInclusive = formData.vat_inclusive;
    }

    return calculateVAT(baseAmount, vatRate, vatInclusive);
  };

  const getInvoiceTenant = (invoice: InvoiceWithDetails): Tenant | ExternalCustomer | null => {
    if (invoice.lease) {
      return invoice.lease.tenant;
    }
    if (invoice.external_customer) {
      return invoice.external_customer;
    }
    return invoice.tenant || null;
  };

  const getInvoiceType = (inv: InvoiceWithDetails): InvoiceTypeFilter => {
    if (inv.lease_id !== null && inv.lease?.lease_type === 'flex') return 'flex';
    if (inv.lease_id !== null) return 'huur';
    if (inv.notes?.includes('Flex werkplek boekingen')) return 'flex';
    if (inv.notes?.includes('Vergaderruimte gebruik') || inv.notes?.includes('Vergaderruimte boekingen') || inv.notes?.includes('Vergaderruimte & Flex werkplek boekingen')) return 'vergaderruimte';
    if (inv.line_items && inv.line_items.some((item: any) => item.booking_id !== null)) {
      return 'vergaderruimte';
    }
    return 'handmatig';
  };

  const getInvoiceTypeColor = (inv: InvoiceWithDetails): string => {
    const type = getInvoiceType(inv);
    switch (type) {
      case 'huur': return 'text-green-500';
      case 'vergaderruimte': return 'text-blue-500';
      case 'flex': return 'text-teal-500';
      case 'handmatig': return 'text-orange-500';
      default: return 'text-gray-400';
    }
  };

  const showInvoicePreview = async (invoice: InvoiceWithDetails) => {
    setLoadingPreview(true);
    try {
      console.log('Loading invoice preview for:', invoice);

      // Check if tenant/customer data exists
      const tenant = getInvoiceTenant(invoice);
      if (!tenant) {
        console.error('No tenant/customer found for invoice:', invoice);
        showToast('Fout: Geen klantgegevens gevonden voor deze factuur.', 'error');
        setLoadingPreview(false);
        return;
      }

      let items = (invoice as any).line_items;

      if (!items || items.length === 0) {
        const { data, error } = await supabase
          .from('invoice_line_items')
          .select(`
            *,
            booking:meeting_room_bookings(
              booking_date,
              start_time,
              end_time,
              total_hours
            )
          `)
          .eq('invoice_id', invoice.id);

        if (error) {
          console.error('Error loading line items:', error);
          showToast('Fout bij het laden van factuurregels.', 'error');
          setLoadingPreview(false);
          return;
        }

        items = data;
      }

      console.log('Loaded line items:', items);
      const spaces = convertLineItemsToSpaces(items || []);
      console.log('Converted spaces:', spaces);

      const enrichedInvoice = { ...invoice, line_items: items } as any;
      const splitscreen = localStorage.getItem('hal5-splitscreen') === 'true';
      const electron = (window as any).electron;
      if (splitscreen && electron?.openPreviewWindow) {
        electron.openPreviewWindow({
          type: 'invoice',
          props: {
            invoice: enrichedInvoice,
            tenant: tenant || { name: '', company_name: '', email: '' },
            spaces,
            contractType: invoice.lease?.lease_type,
            invoiceTypeColor: getInvoiceTypeColor(invoice),
            company: companySettings ? {
              name: companySettings.company_name,
              address: companySettings.address,
              postal_code: companySettings.postal_code,
              city: companySettings.city,
              kvk: companySettings.kvk_number,
              btw: companySettings.vat_number,
              iban: companySettings.bank_account,
              email: companySettings.email,
              phone: companySettings.phone,
              website: companySettings.website
            } : undefined
          }
        });
      } else {
        setPreviewInvoice({ invoice: enrichedInvoice, spaces });
      }
    } catch (error) {
      console.error('Error in showInvoicePreview:', error);
      showToast('Fout bij het tonen van de factuurpreview.', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePreviewDownload = async () => {
    if (!previewInvoice) return;

    const tenant = getInvoiceTenant(previewInvoice.invoice);

    await generateInvoicePDF({
      invoice_number: previewInvoice.invoice.invoice_number,
      tenant_name: tenant?.name || '',
      tenant_company_name: tenant?.company_name || '',
      tenant_email: tenant?.email || '',
      tenant_phone: tenant?.phone || undefined,
      tenant_billing_address: tenant?.billing_address || undefined,
      tenant_street: tenant?.street || undefined,
      tenant_postal_code: tenant?.postal_code || undefined,
      tenant_city: tenant?.city || undefined,
      tenant_country: tenant?.country || undefined,
      invoice_month: previewInvoice.invoice.invoice_month || undefined,
      contract_type: previewInvoice.invoice.lease?.lease_type || undefined,
      notes: previewInvoice.invoice.notes || undefined,
      spaces: previewInvoice.spaces,
      security_deposit: 0,
      subtotal: previewInvoice.invoice.subtotal,
      amount: previewInvoice.invoice.amount,
      vat_amount: previewInvoice.invoice.vat_amount,
      vat_rate: previewInvoice.invoice.vat_rate,
      vat_inclusive: previewInvoice.invoice.vat_inclusive,
      due_date: previewInvoice.invoice.due_date,
      invoice_date: previewInvoice.invoice.invoice_date,
      company: companySettings ? {
        name: companySettings.company_name,
        address: companySettings.address,
        postal_code: companySettings.postal_code,
        city: companySettings.city,
        kvk: companySettings.kvk_number,
        btw: companySettings.vat_number,
        iban: companySettings.bank_account,
        email: companySettings.email,
        phone: companySettings.phone,
        website: companySettings.website
      } : undefined
    }, false);
  };

  const handlePreviewSend = async () => {
    if (!previewInvoice) return;

    const invoice = previewInvoice.invoice;
    const tenant = getInvoiceTenant(invoice);

    if (companySettings && isEmailConfigured(companySettings) && tenant?.email) {
      const tenantName = ('name' in tenant && tenant.name) ? tenant.name : ('contact_name' in tenant && (tenant as any).contact_name) ? (tenant as any).contact_name : tenant.company_name || '';
      const invoiceNum = invoice.invoice_number.replace(/^INV-/, '');
      const formattedAmount = `\u20AC${invoice.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const emailData = {
        recipientName: tenantName,
        invoiceNumber: invoiceNum,
        invoiceDate: new Date(invoice.invoice_date).toLocaleDateString('nl-NL'),
        dueDate: new Date(invoice.due_date).toLocaleDateString('nl-NL'),
        amount: formattedAmount,
        companySettings,
      };
      const htmlBody = buildInvoiceEmailHtml(emailData);
      const textBody = buildInvoiceEmailText(emailData);
      setEmailComposeData({
        to: tenant.email,
        toName: tenantName,
        subject: `Factuur ${invoiceNum} van ${companySettings.company_name}`,
        body: textBody,
        html: htmlBody,
        invoiceId: invoice.id,
      });
      return;
    }

    await sendInvoiceEmail(previewInvoice.invoice.id);
    setPreviewInvoice(null);
  };

  const toggleSelectInvoice = (invoiceId: string) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedInvoices(newSelected);
  };

  const toggleSelectAll = (invoiceList: InvoiceWithDetails[]) => {
    if (selectedInvoices.size === invoiceList.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(invoiceList.map(inv => inv.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedInvoices.size === 0) return;
    setShowDeleteConfirm('bulk');
  };

  const handleBatchStatusChange = async (newStatus: string, skipEBoekhoudenCheck = false) => {
    if (selectedInvoices.size === 0) return;

    if (newStatus === 'paid' && !skipEBoekhoudenCheck && companySettings?.eboekhouden_enabled && companySettings?.eboekhouden_connected) {
      const idsArr = Array.from(selectedInvoices);
      const syncedCount = idsArr.filter(id => invoices.find(inv => inv.id === id)?.eboekhouden_factuur_id).length;
      if (syncedCount > 0) {
        setEBoekhoudenBatchPaidWarning({ syncedCount, totalCount: idsArr.length });
        return;
      }
    }

    if (!window.confirm(`Weet je zeker dat je ${selectedInvoices.size} facturen wilt markeren als ${getStatusLabel(newStatus)}?`)) return;

    const idsToUpdate = Array.from(selectedInvoices);

    for (const id of idsToUpdate) {
      await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', id);
    }

    if (newStatus === 'sent' && companySettings?.eboekhouden_api_token && companySettings?.eboekhouden_connected) {
      for (const id of idsToUpdate) {
        const inv = invoices.find(i => i.id === id);
        if (!inv || inv.eboekhouden_factuur_id) continue;
        const customer = getInvoiceTenant(inv);
        if (!customer) continue;
        const customerType = inv.external_customer ? 'external' as const : 'tenant' as const;
        const { data: lineItems } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', id);
        syncInvoiceToEBoekhouden(
          companySettings.eboekhouden_api_token,
          { ...inv, line_items: lineItems || [] } as any,
          customer as any,
          customerType,
          companySettings
        ).catch(() => {});
      }
    }

    await loadData();
    setSelectedInvoices(new Set());
  };

  if (loading) {
    return <div className="text-center py-8">Facturen laden...</div>;
  }

  return (
    <div className="h-full flex overflow-hidden">

      {eBoekhoudenPaidWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
          <div className="bg-dark-900 rounded-xl w-full max-w-md border border-amber-700 shadow-2xl">
            <div className="px-6 py-5 border-b border-dark-700 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-900 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-100">Gesynchroniseerd met e-Boekhouden</h3>
                <p className="text-xs text-gray-400 mt-0.5">Factuur {eBoekhoudenPaidWarning.invoiceNumber}</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-300 leading-relaxed">
                Deze factuur is gesynchroniseerd met e-Boekhouden. Als je hier op <span className="text-amber-400 font-medium">Betaald</span> drukt, wordt de status alleen lokaal bijgewerkt.
              </p>
              <p className="text-sm text-gray-400 mt-3 leading-relaxed">
                Vergeet niet de betaling ook in e-Boekhouden te registreren, anders loopt de administratie uit de pas.
              </p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={() => setEBoekhoudenPaidWarning(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-dark-600 text-gray-300 hover:bg-dark-700 transition-colors text-sm"
              >
                Annuleren
              </button>
              <button
                onClick={confirmMarkAsPaid}
                className="flex-1 px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white transition-colors text-sm font-medium"
              >
                Toch Betaald Markeren
              </button>
            </div>
          </div>
        </div>
      )}

      {eBoekhoudenBatchPaidWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
          <div className="bg-dark-900 rounded-xl w-full max-w-md border border-amber-700 shadow-2xl">
            <div className="px-6 py-5 border-b border-dark-700 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-900 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-100">Gesynchroniseerde facturen geselecteerd</h3>
                <p className="text-xs text-gray-400 mt-0.5">{eBoekhoudenBatchPaidWarning.syncedCount} van {eBoekhoudenBatchPaidWarning.totalCount} facturen</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-300 leading-relaxed">
                <span className="text-amber-400 font-medium">{eBoekhoudenBatchPaidWarning.syncedCount} {eBoekhoudenBatchPaidWarning.syncedCount === 1 ? 'factuur is' : 'facturen zijn'}</span> gesynchroniseerd met e-Boekhouden. De betaalstatus wordt alleen lokaal bijgewerkt.
              </p>
              <p className="text-sm text-gray-400 mt-3 leading-relaxed">
                Vergeet niet de betalingen ook in e-Boekhouden te registreren.
              </p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={() => setEBoekhoudenBatchPaidWarning(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-dark-600 text-gray-300 hover:bg-dark-700 transition-colors text-sm"
              >
                Annuleren
              </button>
              <button
                onClick={confirmBatchMarkAsPaid}
                className="flex-1 px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white transition-colors text-sm font-medium"
              >
                Toch Betaald Markeren
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-lg w-full max-w-3xl border border-dark-700 flex flex-col max-h-[90vh]">
            <div className="flex-shrink-0 bg-dark-800 rounded-t-lg border-b border-dark-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-100">
                {editingInvoiceId ? 'Factuur Bewerken' : 'Nieuwe Factuur Aanmaken'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">

            {!editingInvoiceId && (
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceMode('lease');
                    setLineItems([]);
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    invoiceMode === 'lease'
                      ? 'bg-gold-500 text-white'
                      : 'bg-dark-800 text-gray-200 hover:bg-dark-700'
                  }`}
                >
                  Van Huurcontract
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceMode('manual');
                    setLineItems([{ description: '', unit_price: '0', quantity: '' }]);
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    invoiceMode === 'manual'
                      ? 'bg-gold-500 text-white'
                      : 'bg-dark-800 text-gray-200 hover:bg-dark-700'
                  }`}
                >
                  Handmatig Samenstellen
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {invoiceMode === 'lease' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Huurcontract / Huurder *
                  </label>
                  <select
                    required
                    disabled={!!editingInvoiceId}
                    value={formData.lease_id}
                    onChange={(e) => handleLeaseSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Selecteer een huurcontract...</option>
                    {leases.map((lease) => {
                      const rentAmount = lease.lease_spaces.reduce((sum, ls) => sum + ls.monthly_rent, 0);
                      const totalMonthlyRent = Math.round((rentAmount + lease.security_deposit) * 100) / 100;
                      return (
                        <option key={lease.id} value={lease.id}>
                          {lease.tenant.company_name} - €{totalMonthlyRent.toFixed(2)}/mo ({lease.vat_rate}% BTW {lease.vat_inclusive ? 'incl.' : 'excl.'})
                        </option>
                      );
                    })}
                  </select>
                  {leases.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Geen actieve huurcontracten beschikbaar. Gebruik handmatig samenstellen of maak eerst een huurcontract aan.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">
                      Klanttype *
                    </label>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        disabled={!!editingInvoiceId}
                        onClick={() => setFormData({ ...formData, customer_type: 'tenant', external_customer_id: '' })}
                        className={`flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          formData.customer_type === 'tenant'
                            ? 'bg-gold-500 text-white'
                            : 'bg-dark-800 text-gray-200 hover:bg-dark-700'
                        }`}
                      >
                        Huurder
                      </button>
                      <button
                        type="button"
                        disabled={!!editingInvoiceId}
                        onClick={() => setFormData({ ...formData, customer_type: 'external', tenant_id: '' })}
                        className={`flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          formData.customer_type === 'external'
                            ? 'bg-gold-500 text-white'
                            : 'bg-dark-800 text-gray-200 hover:bg-dark-700'
                        }`}
                      >
                        Externe Klant
                      </button>
                    </div>
                  </div>

                  {formData.customer_type === 'tenant' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Huurder *
                      </label>
                      <select
                        required
                        disabled={!!editingInvoiceId}
                        value={formData.tenant_id}
                        onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Selecteer een huurder...</option>
                        {tenants.map((tenant) => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.company_name} - {tenant.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Externe Klant *
                      </label>
                      <select
                        required
                        disabled={!!editingInvoiceId}
                        value={formData.external_customer_id}
                        onChange={(e) => setFormData({ ...formData, external_customer_id: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Selecteer een externe klant...</option>
                        {externalCustomers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.company_name} - {customer.contact_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        BTW Percentage *
                      </label>
                      <select
                        value={formData.vat_rate}
                        onChange={(e) => setFormData({ ...formData, vat_rate: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      >
                        <option value="0">0%</option>
                        <option value="9">9%</option>
                        <option value="21">21%</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        BTW Type *
                      </label>
                      <select
                        value={formData.vat_inclusive ? 'inclusive' : 'exclusive'}
                        onChange={(e) => setFormData({ ...formData, vat_inclusive: e.target.value === 'inclusive' })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      >
                        <option value="exclusive">Exclusief</option>
                        <option value="inclusive">Inclusief</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Factuurmaand
                </label>
                <input
                  type="month"
                  value={formData.invoice_month}
                  onChange={(e) => setFormData({ ...formData, invoice_month: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
                <p className="text-xs text-gray-400 mt-1">De maand waarvoor deze factuur is (optioneel)</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Referentie/Kenmerk
                  </label>
                  <input
                    type="text"
                    placeholder="Bijv. projectnummer of kenmerk"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Betalingstermijn (dagen) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.payment_term_days}
                    onChange={(e) => setFormData({ ...formData, payment_term_days: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Factuurdatum *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Vervaldatum *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
              </div>

              {((invoiceMode === 'lease' && formData.lease_id) || (invoiceMode === 'manual' && (formData.tenant_id || formData.external_customer_id))) && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-200">
                      Factuurregels *
                    </label>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="text-sm text-gold-500 hover:text-gold-400"
                    >
                      + Regel Toevoegen
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {lineItems.map((item, index) => {
                      const ebEnabled = companySettings?.eboekhouden_enabled && companySettings?.eboekhouden_connected;
                      const autoCategory = item.local_category || getLocalCategory(item.space_type, item.bookingType);
                      const autoMapping = autoCategory ? grootboekMappings?.find(m => m.local_category === autoCategory) : grootboekMappings?.find(m => m.local_category === 'default');
                      const autoLabel = autoMapping ? `Auto: ${autoMapping.grootboek_code} ${autoMapping.grootboek_omschrijving}` : 'Automatisch';
                      const gridCols = ebEnabled
                        ? (invoiceMode === 'manual' ? '1fr auto auto 2fr auto' : '1fr auto 2fr auto')
                        : (invoiceMode === 'manual' ? '1fr auto auto auto' : '1fr auto auto');
                      return (
                        <div key={index} className="grid gap-1.5 bg-dark-800 rounded-lg px-3 py-2 border border-dark-600" style={{ gridTemplateColumns: gridCols }}>
                          <input
                            type="text"
                            required
                            placeholder="Omschrijving"
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            className="px-2.5 py-1.5 bg-dark-700 border border-dark-600 text-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-gold-500 text-sm min-w-0"
                            readOnly={item.space_type === 'Meeting Room'}
                          />
                          {invoiceMode === 'manual' && (
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Aantal"
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                  updateLineItem(index, 'quantity', value);
                                }
                              }}
                              className="w-20 px-2.5 py-1.5 bg-dark-700 border border-dark-600 text-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-gold-500 text-sm"
                            />
                          )}
                          <input
                            type="text"
                            inputMode="decimal"
                            required
                            placeholder="Prijs"
                            value={item.unit_price}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
                                updateLineItem(index, 'unit_price', value);
                              }
                            }}
                            className="w-24 px-2.5 py-1.5 bg-dark-700 border border-dark-600 text-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-gold-500 text-sm"
                            readOnly={item.space_type === 'Meeting Room'}
                          />
                          {ebEnabled && (
                            <select
                              value={item.grootboek_id || ''}
                              onChange={(e) => updateLineItem(index, 'grootboek_id', e.target.value ? parseInt(e.target.value) : null)}
                              className="px-2.5 py-1.5 bg-dark-700 border border-dark-600 text-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-gold-500 text-sm min-w-0"
                            >
                              <option value="">{autoLabel}</option>
                              {grootboekMappings?.map((mapping) => (
                                <option key={mapping.id} value={mapping.grootboek_id}>
                                  {mapping.grootboek_code} - {mapping.grootboek_omschrijving}
                                </option>
                              ))}
                            </select>
                          )}
                          {lineItems.length > 1 && item.space_type !== 'Meeting Room' ? (
                            <button
                              type="button"
                              onClick={() => removeLineItem(index)}
                              className="flex-shrink-0 text-red-400 hover:text-red-300 transition-colors"
                            >
                              <X size={15} />
                            </button>
                          ) : (
                            <span />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 p-3 bg-dark-800 rounded-lg space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Subtotaal:</span>
                      <span className="font-medium text-gray-100">€{getTotalAmount().subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">
                        BTW ({invoiceMode === 'lease'
                          ? leases.find(l => l.id === formData.lease_id)?.vat_rate
                          : formData.vat_rate}%):
                      </span>
                      <span className="font-medium text-gray-100">€{getTotalAmount().vatAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-dark-600">
                      <span className="font-semibold text-gray-200">Total:</span>
                      <span className="font-bold text-lg text-gray-100">€{getTotalAmount().total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Notities
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  rows={3}
                  placeholder="Aanvullende opmerkingen of betalingsinstructies..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                  disabled={
                    lineItems.length === 0 ||
                    (invoiceMode === 'lease' && !formData.lease_id) ||
                    (invoiceMode === 'manual' && !formData.tenant_id && !formData.external_customer_id)
                  }
                >
                  {editingInvoiceId ? 'Factuur Opslaan' : 'Factuur Aanmaken'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-dark-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {previewInvoice && !loadingPreview && (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <InvoicePreview
            inline
            invoice={previewInvoice.invoice}
            invoiceTypeColor={getInvoiceTypeColor(previewInvoice.invoice)}
            tenant={getInvoiceTenant(previewInvoice.invoice) || {
              name: '',
              company_name: '',
              email: ''
            }}
            spaces={previewInvoice.spaces}
            contractType={previewInvoice.invoice.lease?.lease_type}
            company={companySettings ? {
              name: companySettings.company_name,
              address: companySettings.address,
              postal_code: companySettings.postal_code,
              city: companySettings.city,
              kvk: companySettings.kvk_number,
              btw: companySettings.vat_number,
              iban: companySettings.bank_account,
              email: companySettings.email,
              phone: companySettings.phone,
              website: companySettings.website
            } : undefined}
            onClose={() => setPreviewInvoice(null)}
            onDownload={handlePreviewDownload}
            onSend={previewInvoice.invoice.status === 'draft' ? handlePreviewSend : undefined}
            onEdit={previewInvoice.invoice.status === 'draft' ? () => {
              setPreviewInvoice(null);
              startEditInvoice(previewInvoice.invoice);
            } : undefined}
            onMarkAsPaid={(previewInvoice.invoice.status === 'sent' || previewInvoice.invoice.status === 'overdue') ? () => {
              markAsPaid(previewInvoice.invoice.id);
              setPreviewInvoice(null);
            } : undefined}
            onCreateCreditNote={(previewInvoice.invoice.status === 'draft' && onCreateCreditNote) ? () => {
              const tenant = getInvoiceTenant(previewInvoice.invoice);
              if (tenant && onCreateCreditNote) {
                onCreateCreditNote(previewInvoice.invoice, tenant, previewInvoice.spaces);
                setPreviewInvoice(null);
              }
            } : undefined}
            onRevertToDraft={previewInvoice.invoice.status === 'sent' ? () => {
              revertToDraft(previewInvoice.invoice.id);
              setPreviewInvoice(null);
            } : undefined}
            onPopOut={() => {
              const electron = (window as any).electron;
              if (electron?.openPreviewWindow) {
                const tenant = getInvoiceTenant(previewInvoice.invoice);
                electron.openPreviewWindow({
                  type: 'invoice',
                  props: {
                    invoice: previewInvoice.invoice,
                    tenant: tenant || { name: '', company_name: '', email: '' },
                    spaces: previewInvoice.spaces,
                    contractType: previewInvoice.invoice.lease?.lease_type,
                    invoiceTypeColor: getInvoiceTypeColor(previewInvoice.invoice),
                    company: companySettings ? {
                      name: companySettings.company_name,
                      address: companySettings.address,
                      postal_code: companySettings.postal_code,
                      city: companySettings.city,
                      kvk: companySettings.kvk_number,
                      btw: companySettings.vat_number,
                      iban: companySettings.bank_account,
                      email: companySettings.email,
                      phone: companySettings.phone,
                      website: companySettings.website
                    } : undefined
                  }
                });
                setPreviewInvoice(null);
              }
            }}
          />
        </div>
      )}

      <div className={`flex-1 min-w-0 overflow-y-auto w-full transition-all duration-300 ${previewInvoice ? 'hidden' : ''}`}>
      <div className="space-y-4">
        {(() => {
          const sortByTenantAndDate = (a: InvoiceWithDetails, b: InvoiceWithDetails) => {
            const tenantA = getInvoiceTenant(a);
            const tenantB = getInvoiceTenant(b);
            if (tenantA && tenantB) {
              const nameCompare = tenantA.company_name.localeCompare(tenantB.company_name);
              if (nameCompare !== 0) return nameCompare;
            }
            if (a.invoice_month && b.invoice_month) {
              return b.invoice_month.localeCompare(a.invoice_month);
            }
            return new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime();
          };

          const applyFilters = (list: InvoiceWithDetails[]) => {
            let result = list;
            if (filterType !== 'all') {
              result = result.filter(inv => getInvoiceType(inv) === filterType);
            }
            if (filterCustomer !== 'all') {
              result = result.filter(inv => {
                const tenant = getInvoiceTenant(inv);
                return tenant?.id === filterCustomer;
              });
            }
            return result;
          };

          const allDraftInvoices = applyFilters(
            invoices.filter(inv => inv.status === 'draft')
          ).sort(sortByTenantAndDate);

          const allOpenInvoices = applyFilters(
            invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'draft' && inv.status !== 'credited')
          ).sort(sortByTenantAndDate);

          const uniqueCustomers = Array.from(
            new Map(
              invoices
                .map(inv => getInvoiceTenant(inv))
                .filter((t): t is Tenant | ExternalCustomer => t !== null)
                .map(t => [t.id, t])
            ).values()
          ).sort((a, b) => a.company_name.localeCompare(b.company_name));

          const getInvoiceTypeLabel = (type: InvoiceTypeFilter): string => {
            switch (type) {
              case 'huur': return 'Huur';
              case 'vergaderruimte': return 'Vergaderruimte';
              case 'flex': return 'Flex';
              case 'handmatig': return 'Handmatig';
              default: return '';
            }
          };

          const renderInvoiceRow = (invoice: InvoiceWithDetails, showDueDate: boolean) => {
            const tenant = getInvoiceTenant(invoice);
            const displayName = tenant?.company_name || 'Onbekende huurder';

            return (
              <tr
                key={invoice.id}
                onClick={() => showInvoicePreview(invoice)}
                className="border-b border-dark-600 hover:bg-dark-800 hover:border-gold-500 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => toggleSelectInvoice(invoice.id)}
                    className="text-gray-300 hover:text-gold-500 transition-colors"
                  >
                    {selectedInvoices.has(invoice.id) ? (
                      <CheckSquare size={18} />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="text-gray-500" size={18} />
                    <span className="text-gray-100 font-medium">{displayName}</span>
                  </div>
                </td>
                <td className={`px-4 py-3 ${getInvoiceTypeColor(invoice)} font-medium text-sm`}>
                  {invoice.invoice_number.replace(/^INV-/, '')}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    getInvoiceType(invoice) === 'huur' ? 'bg-green-900/50 text-green-400' :
                    getInvoiceType(invoice) === 'vergaderruimte' ? 'bg-blue-900/50 text-blue-400' :
                    getInvoiceType(invoice) === 'flex' ? 'bg-teal-900/50 text-teal-400' :
                    'bg-amber-900/50 text-amber-400'
                  }`}>
                    {getInvoiceTypeLabel(getInvoiceType(invoice))}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300 text-sm">
                  {invoice.invoice_month ?
                    new Date(invoice.invoice_month + '-01').toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })
                  : '-'}
                </td>
                <td className="px-4 py-3 text-gray-300 text-sm">
                  {new Date(invoice.invoice_date).toLocaleDateString('nl-NL')}
                </td>
                {showDueDate && (
                  <td className="px-4 py-3 text-gray-300 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} className="text-gold-500" />
                      {new Date(invoice.due_date).toLocaleDateString('nl-NL')}
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <div className="text-gray-100 font-bold">
                    {'\u20AC'}{invoice.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {invoice.applied_credit > 0 && (
                    <div className="text-xs text-green-400">
                      -{'\u20AC'}{invoice.applied_credit.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} credit
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                    {getStatusLabel(invoice.status)}
                  </span>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1 justify-end">
                    {invoice.status === 'sent' && (
                      <button
                        onClick={() => {
                          revertToDraft(invoice.id);
                        }}
                        className="text-amber-500 hover:text-amber-400 transition-colors p-1.5 rounded hover:bg-dark-700"
                        title="Terug naar concept"
                      >
                        <RotateCcw size={18} />
                      </button>
                    )}
                    {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                      <button
                        onClick={() => handleMarkAsPaid(invoice.id)}
                        disabled={markingPaidId === invoice.id}
                        className="text-green-500 hover:text-green-400 transition-colors p-1.5 rounded hover:bg-dark-700 disabled:opacity-50"
                        title="Markeer als betaald"
                      >
                        {markingPaidId === invoice.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Check size={18} />
                        )}
                      </button>
                    )}
                    {companySettings?.eboekhouden_enabled && invoice.eboekhouden_factuur_id && (
                      <span className="text-teal-500 p-1.5" title={`Gesynchroniseerd met e-Boekhouden (ID: ${invoice.eboekhouden_factuur_id})`}>
                        <CheckCircle2 size={18} />
                      </span>
                    )}
                    {(invoice.status === 'draft' || invoice.status === 'overdue') && (
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(invoice.id);
                          setDeleteError('');
                          setDeletePassword('');
                        }}
                        className="text-red-500 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-dark-700"
                        title="Verwijderen"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          };

          const draftSelected = allDraftInvoices.filter(inv => selectedInvoices.has(inv.id)).length;
          const openSelected = allOpenInvoices.filter(inv => selectedInvoices.has(inv.id)).length;

          return (
            <>
              <div className="flex flex-wrap items-center gap-3 bg-dark-900 rounded-lg border border-dark-700 px-4 py-3">
                <div className="flex items-center gap-2 text-gray-400">
                  <Filter size={16} />
                  <span className="text-sm font-medium">Filters</span>
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as InvoiceTypeFilter)}
                  className="px-3 py-1.5 bg-dark-800 border border-dark-600 text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  <option value="all">Alle types</option>
                  <option value="huur">Huur</option>
                  <option value="vergaderruimte">Vergaderruimte</option>
                  <option value="flex">Flex</option>
                  <option value="handmatig">Handmatig</option>
                </select>
                <select
                  value={filterCustomer}
                  onChange={(e) => setFilterCustomer(e.target.value)}
                  className="px-3 py-1.5 bg-dark-800 border border-dark-600 text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 max-w-[220px]"
                >
                  <option value="all">Alle klanten</option>
                  {uniqueCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
                {(filterType !== 'all' || filterCustomer !== 'all') && (
                  <button
                    onClick={() => { setFilterType('all'); setFilterCustomer('all'); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 bg-dark-800 border border-dark-600 rounded-lg transition-colors"
                  >
                    <X size={14} />
                    Reset
                  </button>
                )}
                <button
                  onClick={() => setShowForm(true)}
                  className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-gold-500 text-white text-sm font-medium rounded-lg hover:bg-gold-400 transition-colors"
                >
                  <Plus size={16} />
                  Nieuwe Factuur
                </button>
              </div>

              <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700">
                <div className="flex items-center justify-between px-4 py-3 bg-dark-800 border-b border-emerald-500">
                  <h2 className="text-lg font-bold text-gray-100">Concept Facturen</h2>
                  <div className="flex items-center gap-2">
                    {draftSelected > 0 && (
                      <>
                        <div className="flex items-center gap-2 bg-gold-600 text-white px-3 py-1.5 rounded-lg text-sm">
                          <CheckSquare size={16} />
                          {draftSelected} Geselecteerd
                        </div>
                        <button
                          onClick={() => handleBatchStatusChange('sent')}
                          className="flex items-center gap-2 bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors text-sm"
                        >
                          <Send size={16} />
                          Markeer Verzonden
                        </button>
                        <button
                          onClick={handleBatchDelete}
                          className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors text-sm"
                        >
                          <Trash2 size={16} />
                          Verwijder
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed min-w-[1100px]">
                    <thead>
                      <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                        <th className="text-center px-4 py-3 font-semibold w-[4%]">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleSelectAll(allDraftInvoices); }}
                            className="text-gray-300 hover:text-gold-500 transition-colors"
                          >
                            {allDraftInvoices.every(inv => selectedInvoices.has(inv.id)) && allDraftInvoices.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </th>
                        <th className="text-left px-4 py-3 font-semibold w-[15%]">Klant</th>
                        <th className="text-left px-4 py-3 font-semibold w-[9%]">Factuur Nr.</th>
                        <th className="text-center px-4 py-3 font-semibold w-[9%]">Type</th>
                        <th className="text-left px-4 py-3 font-semibold w-[7%]">Maand</th>
                        <th className="text-left px-4 py-3 font-semibold w-[9%]">Factuur Datum</th>
                        <th className="text-left px-4 py-3 font-semibold w-[9%]">Vervaldatum</th>
                        <th className="text-right px-4 py-3 font-semibold w-[9%]">Bedrag</th>
                        <th className="text-center px-4 py-3 font-semibold w-[9%]">Status</th>
                        <th className="text-right px-4 py-3 font-semibold w-[12%]">Acties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allDraftInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                            Geen concept facturen
                          </td>
                        </tr>
                      ) : (
                        allDraftInvoices.map(inv => renderInvoiceRow(inv, true))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700">
                <div className="flex items-center justify-between px-4 py-3 bg-dark-800 border-b border-amber-500">
                  <h2 className="text-lg font-bold text-gray-100">Openstaande Facturen</h2>
                  <div className="flex items-center gap-2">
                    {openSelected > 0 && (
                      <>
                        <div className="flex items-center gap-2 bg-gold-600 text-white px-3 py-1.5 rounded-lg text-sm">
                          <CheckSquare size={16} />
                          {openSelected} Geselecteerd
                        </div>
                        <button
                          onClick={() => handleBatchStatusChange('paid')}
                          className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-sm"
                        >
                          <CheckCircle size={16} />
                          Markeer als Betaald
                        </button>
                        <button
                          onClick={handleBatchDelete}
                          className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors text-sm"
                        >
                          <Trash2 size={16} />
                          Verwijder
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed min-w-[1100px]">
                    <thead>
                      <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                        <th className="text-center px-4 py-3 font-semibold w-[4%]">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleSelectAll(allOpenInvoices); }}
                            className="text-gray-300 hover:text-gold-500 transition-colors"
                          >
                            {allOpenInvoices.every(inv => selectedInvoices.has(inv.id)) && allOpenInvoices.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </th>
                        <th className="text-left px-4 py-3 font-semibold w-[15%]">Klant</th>
                        <th className="text-left px-4 py-3 font-semibold w-[9%]">Factuur Nr.</th>
                        <th className="text-center px-4 py-3 font-semibold w-[9%]">Type</th>
                        <th className="text-left px-4 py-3 font-semibold w-[7%]">Maand</th>
                        <th className="text-left px-4 py-3 font-semibold w-[9%]">Factuur Datum</th>
                        <th className="text-left px-4 py-3 font-semibold w-[9%]">Vervaldatum</th>
                        <th className="text-right px-4 py-3 font-semibold w-[9%]">Bedrag</th>
                        <th className="text-center px-4 py-3 font-semibold w-[9%]">Status</th>
                        <th className="text-right px-4 py-3 font-semibold w-[12%]">Acties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allOpenInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                            Geen openstaande facturen
                          </td>
                        </tr>
                      ) : (
                        allOpenInvoices.map(inv => renderInvoiceRow(inv, true))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          );
        })()}
      </div>
      </div>


      {/* Genereer Facturen Modal */}
      {showGenerateModal && (() => {
        const targetMonth = invoiceMonth;

        const calculateFlexAmount = (lease: any, month: string) => {
          if (lease.flex_pricing_model === 'monthly_unlimited') {
            return lease.flex_monthly_rate || 0;
          } else if (lease.flex_pricing_model === 'daily') {
            const [year, monthNum] = month.split('-').map(Number);
            const daysInMonth = new Date(year, monthNum, 0).getDate();
            const workingDays = Math.round(daysInMonth * (5/7));
            return (lease.flex_daily_rate || 0) * workingDays;
          } else if (lease.flex_pricing_model === 'credit_based') {
            const creditsPerWeek = lease.credits_per_week || 0;
            const weeksInMonth = 4.33;
            const monthlyCredits = Math.round(creditsPerWeek * weeksInMonth);
            return monthlyCredits * (lease.flex_credit_rate || 0);
          }
          return 0;
        };

        const allLeasesToGenerate = targetMonth ? leases.filter(lease => {
          const existingInvoice = invoices.find(
            inv => inv.lease_id === lease.id && inv.invoice_month === targetMonth
          );
          return !existingInvoice;
        }) : [];

        const regularLeasesToGenerate = allLeasesToGenerate.filter(l => l.lease_type !== 'flex');
        const flexLeasesToGenerate = allLeasesToGenerate.filter(l => l.lease_type === 'flex');

        const allCustomers = [...tenants, ...externalCustomers.map(ec => ({
          ...ec,
          isExternal: true
        }))];

        const getCustomerBookings = (customer: any) => {
          const bookingFilter = (booking: any) => {
            const bookingDate = new Date(booking.booking_date);
            const bookingYearMonth = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;
            const isForSelectedMonth = bookingYearMonth === targetMonth;
            const isUnbilled = !booking.invoice_id;
            const isCompleted = booking.status === 'completed';
            const isForCustomer = (customer as any).isExternal
              ? booking.external_customer_id === customer.id
              : booking.tenant_id === customer.id;
            return isForSelectedMonth && isUnbilled && isCompleted && isForCustomer;
          };
          return {
            meeting: meetingRoomBookings.filter(bookingFilter),
            flex: flexDayBookings.filter(bookingFilter)
          };
        };

        const hasNoExistingInvoice = (customer: any) => {
          const existingInvoice = invoices.find(inv => {
            const matchesCustomer = (customer as any).isExternal
              ? inv.external_customer_id === customer.id
              : inv.tenant_id === customer.id;
            return matchesCustomer && inv.invoice_month === targetMonth && !inv.lease_id;
          });
          return !existingInvoice;
        };

        const customersWithMeetingBookings = targetMonth ? allCustomers.filter(customer => {
          const { meeting } = getCustomerBookings(customer);
          return meeting.length > 0;
        }) : [];

        const customersWithFlexBookings = targetMonth ? allCustomers.filter(customer => {
          const { flex } = getCustomerBookings(customer);
          return flex.length > 0;
        }) : [];

        const customersWithBookings = targetMonth ? allCustomers.filter(customer => {
          const { meeting, flex } = getCustomerBookings(customer);
          return meeting.length > 0 || flex.length > 0;
        }) : [];

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-900 rounded-lg shadow-xl border border-dark-700 max-w-5xl w-full max-h-[90vh] flex flex-col">
              <div className="flex-shrink-0 bg-dark-800 px-6 py-4 border-b border-dark-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-100">
                  {generateModalType === 'huur' ? 'Huur Facturen Genereren' : generateModalType === 'bookings' ? 'Boeking Facturen Genereren' : 'Facturen Genereren'}
                </h2>
                <button
                  onClick={() => {
                    setShowGenerateModal(false);
                    setInvoiceMonth('');
                    setSelectedLeases(new Set());
                    setSelectedCustomers(new Set());
                    setShowDetailSelection(true);
                  }}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-6 space-y-4">
                {invoiceMonth && (
                  (generateModalType === 'huur' && (regularLeasesToGenerate.length > 0 || flexLeasesToGenerate.length > 0)) ||
                  (generateModalType === 'bookings' && (customersWithFlexBookings.length > 0 || customersWithMeetingBookings.length > 0)) ||
                  (generateModalType === 'all' && (
                    (invoiceTypeFilter === 'huur' && regularLeasesToGenerate.length > 0) ||
                    (invoiceTypeFilter === 'flex' && (flexLeasesToGenerate.length > 0 || customersWithFlexBookings.length > 0)) ||
                    (invoiceTypeFilter === 'vergaderruimte' && customersWithMeetingBookings.length > 0) ||
                    (invoiceTypeFilter === 'all' && (regularLeasesToGenerate.length > 0 || flexLeasesToGenerate.length > 0 || customersWithBookings.length > 0)) ||
                    (invoiceTypeFilter === 'handmatig')
                  ))
                ) ? (
                  <div className="space-y-4">
                    {/* Maandkeuze en Overzicht tellers - naast elkaar */}
                    <div className="bg-dark-800 rounded-lg p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Maandkeuze - Links */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-300">
                            Factureren voor maand
                          </h4>
                          <input
                            type="month"
                            value={invoiceMonth}
                            onChange={(e) => setInvoiceMonth(e.target.value)}
                            className="w-full px-4 py-2 bg-dark-700 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                          />
                          <div className="space-y-1">
                            {(generateModalType === 'all' || generateModalType === 'huur') && (
                              <p className="text-xs text-emerald-400">
                                Huur wordt vooraf gefactureerd
                              </p>
                            )}
                            {(generateModalType === 'all' || generateModalType === 'bookings') && (
                              <p className="text-xs text-blue-400">
                                Vergaderruimte & Flex worden achteraf gefactureerd
                              </p>
                            )}
                          </div>
                          {invoiceMonth && (
                            <div className="space-y-2">
                              {((invoicedMonths.leaseCount.get(invoiceMonth) || 0) > 0 || (invoicedMonths.meetingRoomCount.get(invoiceMonth) || 0) > 0) && (
                                <div className="space-y-1 mt-2">
                                  {(invoicedMonths.leaseCount.get(invoiceMonth) || 0) > 0 && (
                                    <div className="flex items-center gap-1 text-amber-500 text-xs">
                                      <AlertCircle size={12} />
                                      <span>
                                        {invoicedMonths.leaseCount.get(invoiceMonth)} huur bestaat al
                                      </span>
                                    </div>
                                  )}
                                  {(invoicedMonths.meetingRoomCount.get(invoiceMonth) || 0) > 0 && (
                                    <div className="flex items-center gap-1 text-amber-500 text-xs">
                                      <AlertCircle size={12} />
                                      <span>
                                        {invoicedMonths.meetingRoomCount.get(invoiceMonth)} vergader bestaat al
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {(generateModalType === 'huur' || generateModalType === 'all') && (invoiceTypeFilter === 'huur' || invoiceTypeFilter === 'all') && regularLeasesToGenerate.length > 0 && (
                          <div className="bg-dark-700 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-emerald-500 mb-1">
                              <Home size={16} />
                              <span className="text-sm font-medium">Huurcontracten</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-100">{Array.from(selectedLeases).filter(id => regularLeasesToGenerate.some(l => l.id === id)).length}</div>
                            <div className="text-xs text-gray-400">van {regularLeasesToGenerate.length} beschikbaar</div>
                          </div>
                        )}

                        {(generateModalType === 'huur' || generateModalType === 'all') && (invoiceTypeFilter === 'flex' || invoiceTypeFilter === 'all') && flexLeasesToGenerate.length > 0 && (
                          <div className="bg-dark-700 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-teal-500 mb-1">
                              <Zap size={16} />
                              <span className="text-sm font-medium">Flex contracten</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-100">{Array.from(selectedLeases).filter(id => flexLeasesToGenerate.some(l => l.id === id)).length}</div>
                            <div className="text-xs text-gray-400">van {flexLeasesToGenerate.length} beschikbaar</div>
                          </div>
                        )}

                        {(generateModalType === 'bookings' || generateModalType === 'all') && (invoiceTypeFilter === 'flex' || invoiceTypeFilter === 'all') && customersWithFlexBookings.length > 0 && (
                          <div className="bg-dark-700 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-teal-500 mb-1">
                              <Zap size={16} />
                              <span className="text-sm font-medium">Flex boekingen</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-100">{Array.from(selectedCustomers).filter(id => customersWithFlexBookings.some(c => c.id === id)).length}</div>
                            <div className="text-xs text-gray-400">van {customersWithFlexBookings.length} beschikbaar</div>
                          </div>
                        )}

                        {(generateModalType === 'bookings' || generateModalType === 'all') && (invoiceTypeFilter === 'vergaderruimte' || invoiceTypeFilter === 'all') && customersWithMeetingBookings.length > 0 && (
                          <div className="bg-dark-700 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-blue-500 mb-1">
                              <Calendar size={16} />
                              <span className="text-sm font-medium">Vergaderruimtes</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-100">{Array.from(selectedCustomers).filter(id => customersWithMeetingBookings.some(c => c.id === id)).length}</div>
                            <div className="text-xs text-gray-400">van {customersWithMeetingBookings.length} beschikbaar</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Gedetailleerde selectie - 3 kolommen naast elkaar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Huurcontracten */}
                      {(generateModalType === 'huur' || generateModalType === 'all') && (invoiceTypeFilter === 'huur' || invoiceTypeFilter === 'all') && regularLeasesToGenerate.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Home size={16} className="text-emerald-500" />
                                Huurcontracten ({regularLeasesToGenerate.length})
                              </h4>
                            </div>
                            <div className="flex gap-2 text-xs">
                              <button
                                onClick={() => selectAllLeases(regularLeasesToGenerate.map(l => l.id))}
                                className="text-gold-500 hover:text-gold-400"
                              >
                                Alles
                              </button>
                              <span className="text-gray-600">|</span>
                              <button
                                onClick={() => setSelectedLeases(new Set(Array.from(selectedLeases).filter(id => !regularLeasesToGenerate.some(l => l.id === id))))}
                                className="text-gray-500 hover:text-gray-400"
                              >
                                Niets
                              </button>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                              {regularLeasesToGenerate.map(lease => {
                                const rentAmount = lease.lease_spaces.reduce((sum, ls) => sum + ls.monthly_rent, 0);
                                const total = Math.round((rentAmount + lease.security_deposit) * 100) / 100;

                                return (
                                  <div
                                    key={lease.id}
                                    onClick={() => toggleLeaseSelection(lease.id)}
                                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                      selectedLeases.has(lease.id)
                                        ? 'bg-emerald-900/20 border-emerald-700'
                                        : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedLeases.has(lease.id)}
                                      onChange={() => {}}
                                      className="w-4 h-4 rounded border-dark-600 text-emerald-600 focus:ring-emerald-500 flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-200 truncate">
                                        {lease.tenant?.company_name}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        {lease.lease_spaces.length} ruimte(s)
                                      </div>
                                    </div>
                                    <div className="text-sm font-medium text-gray-200 flex-shrink-0">
                                      €{total.toFixed(2)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Flex contracten */}
                        {(generateModalType === 'huur' || generateModalType === 'all') && (invoiceTypeFilter === 'flex' || invoiceTypeFilter === 'all') && flexLeasesToGenerate.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Zap size={16} className="text-teal-500" />
                                Flex contracten ({flexLeasesToGenerate.length})
                              </h4>
                            </div>
                            <div className="flex gap-2 text-xs">
                              <button
                                onClick={() => selectAllLeases(flexLeasesToGenerate.map(l => l.id))}
                                className="text-gold-500 hover:text-gold-400"
                              >
                                Alles
                              </button>
                              <span className="text-gray-600">|</span>
                              <button
                                onClick={() => setSelectedLeases(new Set(Array.from(selectedLeases).filter(id => !flexLeasesToGenerate.some(l => l.id === id))))}
                                className="text-gray-500 hover:text-gray-400"
                              >
                                Niets
                              </button>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                              {flexLeasesToGenerate.map(lease => {
                                const rentAmount = calculateFlexAmount(lease, targetMonth);
                                const total = Math.round((rentAmount + lease.security_deposit) * 100) / 100;

                                return (
                                  <div
                                    key={lease.id}
                                    onClick={() => toggleLeaseSelection(lease.id)}
                                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                      selectedLeases.has(lease.id)
                                        ? 'bg-teal-900/20 border-teal-700'
                                        : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedLeases.has(lease.id)}
                                      onChange={() => {}}
                                      className="w-4 h-4 rounded border-dark-600 text-teal-600 focus:ring-teal-500 flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-200 truncate">
                                        {lease.tenant?.company_name}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        Flexplek
                                      </div>
                                    </div>
                                    <div className="text-sm font-medium text-gray-200 flex-shrink-0">
                                      €{total.toFixed(2)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Flex boekingen */}
                        {(generateModalType === 'bookings' || generateModalType === 'all') && (invoiceTypeFilter === 'flex' || invoiceTypeFilter === 'all') && customersWithFlexBookings.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Zap size={16} className="text-teal-500" />
                                Flex boekingen ({customersWithFlexBookings.length})
                              </h4>
                            </div>
                            <div className="flex gap-2 text-xs">
                              <button
                                onClick={() => selectAllCustomers(customersWithFlexBookings.map(c => c.id))}
                                className="text-gold-500 hover:text-gold-400"
                              >
                                Alles
                              </button>
                              <span className="text-gray-600">|</span>
                              <button
                                onClick={() => deselectAllCustomers()}
                                className="text-gray-500 hover:text-gray-400"
                              >
                                Niets
                              </button>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                              {customersWithFlexBookings.map(customer => {
                                const { flex: customerFlexBookings } = getCustomerBookings(customer);
                                const total = customerFlexBookings.reduce((sum, booking) => sum + booking.total_amount, 0);

                                return (
                                  <div
                                    key={customer.id}
                                    onClick={() => toggleCustomerSelection(customer.id)}
                                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                      selectedCustomers.has(customer.id)
                                        ? 'bg-teal-900/20 border-teal-700'
                                        : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedCustomers.has(customer.id)}
                                      onChange={() => {}}
                                      className="w-4 h-4 rounded border-dark-600 text-teal-600 focus:ring-teal-500 flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-200 truncate">
                                        {customer.company_name}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        {customerFlexBookings.length} boeking{customerFlexBookings.length > 1 ? 'en' : ''}
                                      </div>
                                    </div>
                                    <div className="text-sm font-medium text-gray-200 flex-shrink-0">
                                      €{total.toFixed(2)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Vergaderruimte boekingen */}
                        {(generateModalType === 'bookings' || generateModalType === 'all') && (invoiceTypeFilter === 'vergaderruimte' || invoiceTypeFilter === 'all') && customersWithMeetingBookings.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Calendar size={16} className="text-blue-500" />
                                Vergaderruimte boekingen ({customersWithMeetingBookings.length})
                              </h4>
                            </div>
                            <div className="flex gap-2 text-xs">
                              <button
                                onClick={() => selectAllCustomers(customersWithMeetingBookings.map(c => c.id))}
                                className="text-gold-500 hover:text-gold-400"
                              >
                                Alles
                              </button>
                              <span className="text-gray-600">|</span>
                              <button
                                onClick={() => deselectAllCustomers()}
                                className="text-gray-500 hover:text-gray-400"
                              >
                                Niets
                              </button>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                              {customersWithMeetingBookings.map(customer => {
                                const { meeting: customerMeetingBookings } = getCustomerBookings(customer);
                                const total = customerMeetingBookings.reduce((sum, booking) => sum + booking.total_amount, 0);

                                return (
                                  <div
                                    key={customer.id}
                                    onClick={() => toggleCustomerSelection(customer.id)}
                                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                      selectedCustomers.has(customer.id)
                                        ? 'bg-blue-900/20 border-blue-700'
                                        : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedCustomers.has(customer.id)}
                                      onChange={() => {}}
                                      className="w-4 h-4 rounded border-dark-600 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-200 truncate">
                                        {customer.company_name}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        {customerMeetingBookings.length} boeking{customerMeetingBookings.length > 1 ? 'en' : ''}
                                      </div>
                                    </div>
                                    <div className="text-sm font-medium text-gray-200 flex-shrink-0">
                                      €{total.toFixed(2)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                    {/* Gele Knop - Helemaal onderaan */}
                    <div className="bg-dark-800 rounded-lg p-4">
                      <button
                        onClick={(e) => {
                          console.log('Button clicked!', e);
                          console.log('selectedLeases.size:', selectedLeases.size);
                          console.log('selectedCustomers.size:', selectedCustomers.size);
                          console.log('generatingBulk:', generatingBulk);
                          generateAllInvoices();
                        }}
                        disabled={(selectedLeases.size === 0 && selectedCustomers.size === 0) || generatingBulk}
                        className="w-full px-6 py-4 bg-gold-500 text-white font-semibold text-lg rounded-lg hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {generatingBulk ? 'Facturen worden gegenereerd...' : `Genereer ${selectedLeases.size + selectedCustomers.size} ${(selectedLeases.size + selectedCustomers.size) !== 1 ? 'facturen' : 'factuur'}`}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Maandkeuze - wanneer er geen facturen zijn */}
                    <div className="bg-dark-800 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Factureren voor maand
                      </label>
                      <input
                        type="month"
                        value={invoiceMonth}
                        onChange={(e) => setInvoiceMonth(e.target.value)}
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                      {invoiceMonth && (
                        <div className="mt-3">
                          <div className="text-sm text-gray-300">
                            Geselecteerd: <span className="font-bold text-gold-500">
                              {new Date(invoiceMonth + '-01').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {invoiceMonth && (
                      <div className="text-center py-8 text-gray-400">
                        Geen facturen te genereren voor deze maand
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-6 max-w-md w-full mx-4 border border-dark-700">
            <h3 className="text-xl font-bold text-gray-100 mb-4">
              {showDeleteConfirm === 'bulk' ? 'Facturen Wissen' : 'Factuur Wissen'}
            </h3>
            <p className="text-gray-300 mb-4">
              {showDeleteConfirm === 'bulk'
                ? `Weet je zeker dat je ${selectedInvoices.size} facturen wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.`
                : 'Weet je zeker dat je deze factuur wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.'
              }
            </p>
            {deleteError && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-sm">
                {deleteError}
              </div>
            )}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Voer code in:
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-amber-500 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Code"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(null);
                  setDeletePassword('');
                  setDeleteError('');
                }}
                className="flex-1 px-4 py-2.5 border border-dark-600 text-gray-200 rounded-lg hover:bg-dark-700 transition-colors font-medium"
              >
                Annuleren
              </button>
              <button
                onClick={() => deleteInvoice(showDeleteConfirm)}
                className="flex-1 px-4 py-2.5 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors font-medium"
              >
                Wissen
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-8 border border-dark-700">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500"></div>
              <p className="text-gray-200 font-medium">Preview laden...</p>
            </div>
          </div>
        </div>
      )}


      {emailComposeData && companySettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Send size={16} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-100">E-mail Voorbeeld</h3>
                  <p className="text-xs text-gray-500">
                    Via {getActiveEmailMethodLabel(companySettings)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEmailComposeData(null)}
                className="text-gray-500 hover:text-gray-300 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-dark-700 flex-shrink-0 space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 w-16 flex-shrink-0">Aan:</span>
                <span className="text-gray-200">{emailComposeData.toName} &lt;{emailComposeData.to}&gt;</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 w-16 flex-shrink-0">Onderwerp:</span>
                <span className="text-gray-200 font-medium">{emailComposeData.subject}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 w-16 flex-shrink-0">Bijlage:</span>
                <span className="flex items-center gap-1.5 text-gray-300">
                  <FileText size={14} className="text-red-400" />
                  {invoices.find(i => i.id === emailComposeData.invoiceId)?.invoice_number || 'factuur'}.pdf
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto bg-gray-100">
              <iframe
                srcDoc={emailComposeData.html}
                title="E-mail voorbeeld"
                className="w-full h-full border-0"
                style={{ minHeight: '400px' }}
                sandbox="allow-same-origin"
              />
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-dark-700 flex-shrink-0">
              <button
                onClick={() => setEmailComposeData(null)}
                className="px-4 py-2.5 text-sm text-gray-400 hover:text-gray-200 bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={async () => {
                  const invoiceId = emailComposeData.invoiceId;
                  setSendingEmailId(invoiceId);
                  try {
                    await sendInvoiceEmail(invoiceId);
                    setEmailComposeData(null);
                    setPreviewInvoice(null);
                    showToast('Factuur succesvol verzonden per e-mail', 'success');
                    await loadData();
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : 'Fout bij verzenden', 'error');
                  } finally {
                    setSendingEmailId(null);
                  }
                }}
                disabled={sendingEmailId === emailComposeData.invoiceId}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {sendingEmailId === emailComposeData.invoiceId ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {sendingEmailId === emailComposeData.invoiceId ? 'Verzenden...' : 'Versturen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pdfSyncStatus.active && (
        <div className="fixed bottom-4 right-4 z-[100] max-w-sm">
          <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl px-4 py-3">
            <div className="flex items-center gap-3">
              <RefreshCw size={18} className="text-gold-500 animate-spin flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-100">PDF's synchroniseren...</p>
                {pdfSyncStatus.total > 0 && (
                  <>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{pdfSyncStatus.invoiceNumber} ({pdfSyncStatus.current}/{pdfSyncStatus.total})</p>
                    <div className="w-full bg-dark-700 rounded-full h-1.5 mt-2">
                      <div
                        className="bg-gold-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${(pdfSyncStatus.current / pdfSyncStatus.total) * 100}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-md">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
});
