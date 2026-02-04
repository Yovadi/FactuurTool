import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { supabase, type Invoice, type Lease, type Tenant, type ExternalCustomer, type LeaseSpace, type OfficeSpace, type InvoiceLineItem } from '../lib/supabase';
import { Plus, FileText, Eye, Calendar, CheckCircle, Download, Trash2, Send, CreditCard as Edit, Search, CreditCard as Edit2, AlertCircle, CheckSquare, Square, Check, X, Home, Zap } from 'lucide-react';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { InvoicePreview } from './InvoicePreview';
import { checkAndRunScheduledJobs } from '../utils/scheduledJobs';

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

export type InvoiceTypeFilter = 'all' | 'huur' | 'vergaderruimte' | 'flex' | 'handmatig';

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
  const [showDetailSelection, setShowDetailSelection] = useState(true);

  useImperativeHandle(ref, () => ({
    openGenerateModal: async () => {
      const defaultMonth = await getDefaultInvoiceMonth(invoiceTypeFilter);
      setInvoiceMonth(defaultMonth);
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

    const interval = setInterval(() => {
      checkAndRunScheduledJobs();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    updateInvoicedMonthsCounts();
  }, [invoices]);

  const loadData = async () => {
    setLoading(true);

    const { data: companyData } = await supabase
      .from('company_settings')
      .select('*')
      .maybeSingle();

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

    const { data: flexBookingsData } = await supabase
      .from('flex_day_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        total_hours,
        total_amount,
        invoice_id,
        tenant_id,
        external_customer_id,
        space:office_spaces(space_number)
      `)
      .eq('status', 'completed')
      .order('booking_date', { ascending: false });

    setFlexDayBookings(flexBookingsData || []);
    setLoading(false);
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

      const existingInvoice = invoices.find(inv => {
        const matchesCustomer = (customer as any).isExternal
          ? inv.external_customer_id === customer.id
          : inv.tenant_id === customer.id;
        return matchesCustomer && inv.invoice_month === invoiceMonth && !inv.lease_id;
      });

      return !existingInvoice;
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
        bookingId: item.booking_id || undefined
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
      alert('Selecteer een huurcontract');
      return;
    }

    if (invoiceMode === 'manual') {
      if (formData.customer_type === 'tenant' && !formData.tenant_id) {
        alert('Selecteer een huurder');
        return;
      }
      if (formData.customer_type === 'external' && !formData.external_customer_id) {
        alert('Selecteer een externe klant');
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
          booking_id: item.bookingId || null
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
          booking_id: item.bookingId || null
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
            space_type: spaceType
          };
        }));

      if (lease.security_deposit > 0) {
        items.push({
          description: 'Voorschot Gas, Water & Electra',
          unit_price: lease.security_deposit.toFixed(2)
        });
      }

      setLineItems(items);
    }
    setFormData({ ...formData, lease_id: leaseId });
  };

  const updateLineItem = (index: number, field: string, value: string) => {
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

    // Update local state without full reload
    setInvoices(prev => prev.map(inv =>
      inv.id === invoiceId
        ? { ...inv, status: 'paid' as const, paid_at: new Date().toISOString() }
        : inv
    ));
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

      if (window.electronAPI) {
        console.log('Using Electron API to send email');
        console.log('Generating PDF...');
        const pdf = await generateInvoicePDF(invoiceData, false, true);
        const pdfBlob = pdf.output('arraybuffer');
        console.log('PDF generated, size:', pdfBlob.byteLength);

        if (companySettings.root_folder_path && window.electronAPI.savePDF) {
          const invoiceYear = new Date(invoice.invoice_date).getFullYear().toString();
          const tenantFolderPath = `${companySettings.root_folder_path}/${tenant.company_name}/${invoiceYear}`;
          const fileName = `${invoice.invoice_number}.pdf`;

          const saveResult = await window.electronAPI.savePDF(
            pdfBlob,
            tenantFolderPath,
            fileName
          );

          if (!saveResult.success) {
            console.error('Error saving PDF:', saveResult.error);
          }
        }

        const tenantName = ('name' in tenant && tenant.name) ? tenant.name : ('contact_name' in tenant && tenant.contact_name) ? tenant.contact_name : tenant.company_name || '';
        const emailBody = `Beste ${tenantName},

Hierbij ontvangt u factuur ${invoice.invoice_number.replace(/^INV-/, '')} van ${companySettings.company_name}.

Gelieve het bedrag binnen de gestelde termijn over te maken naar IBAN ${companySettings.bank_account}.`;

        console.log('Calling sendEmailWithPDF...');
        const result = await window.electronAPI.sendEmailWithPDF(
          pdfBlob,
          tenant.email,
          `Factuur ${invoice.invoice_number.replace(/^INV-/, '')} van ${companySettings.company_name}`,
          emailBody,
          invoice.invoice_number.replace(/^INV-/, ''),
          null
        );

        console.log('sendEmailWithPDF result:', result);

        if (!result.success) {
          throw new Error(result.error || 'Fout bij openen van Outlook');
        }

        if (result.warning) {
          console.warn(result.warning);
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

      // Update local state without full reload
      setInvoices(prev => prev.map(inv =>
        inv.id === invoiceId
          ? { ...inv, status: 'sent' as const, sent_at: new Date().toISOString() }
          : inv
      ));
    } catch (error) {
      console.error('Error sending invoice:', error);
      console.error('Error sending invoice:', error instanceof Error ? error.message : 'Unknown error');
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
      alert('Selecteer eerst de klanten waarvoor je facturen wilt genereren.');
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
          const bookingLine = `- ${booking.space?.space_number || 'Vergaderruimte'} - ${new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)} (${rateDescription}) = €${beforeDiscountAmount.toFixed(2)}`;
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

          const description = `${booking.space?.space_number || 'Vergaderruimte'} - ${new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)} (${rateDescription})`;

          const beforeDiscountAmount = (booking.total_amount || 0) + (booking.discount_amount || 0);

          const items = [{
            invoice_id: newInvoice.id,
            description: description,
            quantity: booking.total_hours,
            unit_price: booking.applied_rate || booking.hourly_rate,
            amount: beforeDiscountAmount,
            booking_id: booking.id
          }];

          if (booking.discount_percentage && booking.discount_percentage > 0 && booking.discount_amount && booking.discount_amount > 0) {
            items.push({
              invoice_id: newInvoice.id,
              description: `Korting ${booking.discount_percentage}% op ${booking.space?.space_number || 'vergaderruimte'}`,
              quantity: 1,
              unit_price: -(booking.discount_amount),
              amount: -(booking.discount_amount),
              booking_id: null
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
            booking_id: null
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
      alert('Selecteer eerst de huurcontracten waarvoor je facturen wilt genereren.');
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
              amount: rentAmount
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
              quantity_label: 'dagen'
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
              quantity_label: 'dagen'
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
              amount: monthlyRent
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
            amount: -discountAmount
          });
        }

        if (securityDeposit > 0) {
          lineItemsToInsert.push({
            invoice_id: newInvoice.id,
            description: 'Voorschot Gas, Water & Electra',
            quantity: 1,
            unit_price: securityDeposit,
            amount: securityDeposit
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
    console.log('========================================\n');

    if (selectedLeases.size === 0 && selectedCustomers.size === 0) {
      alert('Selecteer eerst de huurcontracten en/of klanten waarvoor je facturen wilt genereren.');
      return;
    }

    let totalSuccess = 0;

    if (selectedLeases.size > 0) {
      const leaseSuccess = await generateBulkInvoices();
      totalSuccess += leaseSuccess || 0;
    }

    if (selectedCustomers.size > 0) {
      await generateMeetingRoomInvoicesForSelectedCustomers();
    } else if (totalSuccess > 0) {
      await loadData();
      setShowGenerateModal(false);
      setInvoiceMonth('');
      setSelectedLeases(new Set());
      setSelectedCustomers(new Set());
      setShowDetailSelection(true);
    }
  };

  const generateMeetingRoomInvoicesForSelectedCustomers = async () => {
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

    const selectedCustomersArray = Array.from(selectedCustomers);
    for (const customerId of selectedCustomersArray) {
      const customer = [...tenants, ...externalCustomers].find(c => c.id === customerId);
      if (!customer) continue;

        const isExternal = externalCustomers.some(ec => ec.id === customerId);

        const existingInvoice = invoices.find(inv => {
          const matchesCustomer = isExternal
            ? inv.external_customer_id === customerId
            : inv.tenant_id === customerId;
          return matchesCustomer && inv.invoice_month === targetMonth && !inv.lease_id;
        });

        if (existingInvoice) {
          console.log(`Skipping duplicate meeting room invoice for customer ${customerId} for month ${targetMonth}`);
          meetingFail++;
          continue;
        }

        try {
          const bookings = await fetchMeetingRoomBookingsForMonth(
            customerId,
            targetMonth,
            isExternal ? 'external' : 'tenant'
          );

          if (bookings.length === 0) {
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

            const bookingAmount = booking.total_amount || 0;
            const bookingDiscount = booking.discount_amount || 0;
            const beforeDiscountAmount = bookingAmount + bookingDiscount;
            const bookingLine = `- ${booking.space?.space_number || 'Vergaderruimte'} - ${new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)} (${rateDescription}) = €${beforeDiscountAmount.toFixed(2)}`;
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

            return {
              invoice_id: newInvoice.id,
              description: `${booking.space?.space_number || 'Vergaderruimte'} - ${new Date(booking.booking_date).toLocaleDateString('nl-NL')} ${booking.start_time}-${booking.end_time}`,
              quantity: booking.total_hours,
              unit_price: booking.hourly_rate,
              amount: beforeDiscountAmount,
              booking_id: booking.id
            };
          });

          if (totalDiscountAmount > 0 && customerDiscountPercentage > 0) {
            const spaceName = bookings.length === 1
              ? bookings[0].space?.space_number || 'Vergaderruimte'
              : 'Vergaderruimtes';
            lineItems.push({
              invoice_id: newInvoice.id,
              description: `Korting ${Math.round(customerDiscountPercentage)}% op ${spaceName}`,
              quantity: 1,
              unit_price: -totalDiscountAmount,
              amount: -totalDiscountAmount,
              booking_id: null
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

          const allBookingIds = bookings.map(b => b.id);
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

          meetingSuccess++;
        } catch (err) {
          console.error('Unexpected error generating meeting room invoice:', err);
          meetingFail++;
        }
      }

    setGeneratingBulk(false);

    if (meetingSuccess > 0) {
      await loadData();
      setShowGenerateModal(false);
      setInvoiceMonth('');
      setSelectedLeases(new Set());
      setSelectedCustomers(new Set());
      setShowDetailSelection(true);
    }
    if (meetingFail > 0) {
      console.log(`${meetingFail} facturen overgeslagen (bestaan al of fout)`);
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


  const showInvoicePreview = async (invoice: InvoiceWithDetails) => {
    setLoadingPreview(true);
    try {
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
        }

        items = data;
      }

      console.log('Loaded line items:', items);
      const spaces = convertLineItemsToSpaces(items || []);
      setPreviewInvoice({ invoice: { ...invoice, line_items: items } as any, spaces });
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

    setPreviewInvoice(null);
  };

  const handlePreviewSend = async () => {
    if (!previewInvoice) return;

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

  const handleBatchStatusChange = async (newStatus: string) => {
    if (selectedInvoices.size === 0) return;
    if (!window.confirm(`Weet je zeker dat je ${selectedInvoices.size} facturen wilt markeren als ${getStatusLabel(newStatus)}?`)) return;

    const idsToUpdate = Array.from(selectedInvoices);

    for (const id of idsToUpdate) {
      await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', id);
    }

    await fetchInvoices();
    setSelectedInvoices(new Set());
  };

  if (loading) {
    return <div className="text-center py-8">Facturen laden...</div>;
  }

  return (
    <div className="h-full overflow-y-auto">

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-900 rounded-lg w-full max-w-2xl my-8 mx-4 border border-dark-700">
            <div className="sticky top-0 bg-dark-800 rounded-t-lg border-b border-dark-700 px-6 py-4 flex items-center justify-between">
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
            <div className="p-6">

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
                  <div className="space-y-2">
                    {lineItems.map((item, index) => (
                      <div key={index} className="space-y-1">
                        {item.space_type === 'Meeting Room' && (
                          <div className="flex items-center gap-2 text-xs text-blue-400">
                            <span className="bg-blue-900/30 px-2 py-0.5 rounded">Vergaderruimte boekingen</span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Omschrijving"
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                            readOnly={item.space_type === 'Meeting Room'}
                          />
                        {invoiceMode === 'manual' && (
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Aantal (optioneel)"
                            value={item.quantity || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                updateLineItem(index, 'quantity', value);
                              }
                            }}
                            className="w-32 px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
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
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              updateLineItem(index, 'unit_price', value);
                            }
                          }}
                          className="w-32 px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                          readOnly={item.space_type === 'Meeting Room'}
                        />
                        {lineItems.length > 1 && item.space_type !== 'Meeting Room' && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            className="text-red-400 hover:text-red-300"
                          >
                            ×
                          </button>
                        )}
                        </div>
                      </div>
                    ))}
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

      <div className="space-y-8">
        {(() => {
          const allDraftInvoices = invoices.filter(inv => inv.status === 'draft');

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

          const getInvoiceType = (inv: InvoiceWithDetails): InvoiceTypeFilter => {
            if (inv.lease_id !== null && inv.lease?.lease_type === 'flex') return 'flex';
            if (inv.lease_id !== null) return 'huur';
            if (inv.notes?.includes('Vergaderruimte gebruik') || inv.notes?.includes('Vergaderruimte boekingen')) return 'vergaderruimte';
            if (inv.notes?.includes('Flex werkplek gebruik') || inv.notes?.includes('Flex werkplek boekingen')) return 'flex';
            if (inv.line_items && inv.line_items.some((item: any) => item.booking_id !== null)) {
              return 'vergaderruimte';
            }
            return 'handmatig';
          };

          const draftHuurInvoices = allDraftInvoices
            .filter(inv => getInvoiceType(inv) === 'huur')
            .sort(sortByTenantAndDate);

          const draftFlexInvoices = allDraftInvoices
            .filter(inv => getInvoiceType(inv) === 'flex')
            .sort(sortByTenantAndDate);

          const draftMeetingRoomInvoices = allDraftInvoices
            .filter(inv => getInvoiceType(inv) === 'vergaderruimte')
            .sort(sortByTenantAndDate);

          const draftManualInvoices = allDraftInvoices
            .filter(inv => getInvoiceType(inv) === 'handmatig')
            .sort(sortByTenantAndDate);

            const openInvoices = invoices
              .filter(inv => inv.status !== 'paid' && inv.status !== 'draft')
              .sort(sortByTenantAndDate);

            const filterOpenInvoices = (type: InvoiceTypeFilter) => {
              if (type === 'all') return openInvoices;
              return openInvoices.filter(inv => getInvoiceType(inv) === type);
            };

            const filteredOpenInvoices = filterOpenInvoices(invoiceTypeFilter);

            console.log('DEBUG Invoice Filtering:', {
              invoiceTypeFilter,
              totalInvoices: invoices.length,
              draftCount: allDraftInvoices.length,
              openCount: openInvoices.length,
              filteredOpenCount: filteredOpenInvoices.length,
              draftByType: {
                huur: draftHuurInvoices.length,
                flex: draftFlexInvoices.length,
                vergaderruimte: draftMeetingRoomInvoices.length,
                handmatig: draftManualInvoices.length
              },
              openInvoicesTypes: openInvoices.map(inv => ({
                number: inv.invoice_number,
                type: getInvoiceType(inv),
                hasLineItems: !!inv.line_items,
                lineItemsCount: inv.line_items?.length || 0,
                hasBookingIds: inv.line_items?.some((item: any) => item.booking_id !== null) || false,
                notes: inv.notes?.substring(0, 50)
              }))
            });

          const renderInvoiceTable = (invoices: typeof draftHuurInvoices, title: string, borderColor: string, buttonConfig?: { label: string; onClick: () => void; color: string; disabled?: boolean }) => {
            const selectedInThisTable = invoices.filter(inv => selectedInvoices.has(inv.id)).length;
            return (
            <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700">
              <div className="flex items-center justify-between px-4 py-3 bg-dark-800 border-b" style={{ borderBottomColor: borderColor }}>
                <h2 className="text-lg font-bold text-gray-100">
                  {title}
                </h2>
                <div className="flex items-center gap-2">
                  {selectedInThisTable > 0 && (
                    <>
                      <div className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm">
                        <CheckSquare size={16} />
                        {selectedInThisTable} Geselecteerd
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
                  {buttonConfig && (
                    <button
                      onClick={buttonConfig.onClick}
                      disabled={buttonConfig.disabled}
                      className={`flex items-center gap-2 ${buttonConfig.color} text-white px-4 py-2 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Calendar size={18} />
                      {buttonConfig.label}
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                    <th className="text-center px-4 py-3 font-semibold w-[5%]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectAll(invoices);
                        }}
                        className="text-gray-300 hover:text-gold-500 transition-colors"
                      >
                        {invoices.every(inv => selectedInvoices.has(inv.id)) && invoices.length > 0 ? (
                          <CheckSquare size={18} />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-semibold w-[19%]">Klant</th>
                    <th className="text-left px-4 py-3 font-semibold w-[10%]">Factuur Nr.</th>
                    <th className="text-left px-4 py-3 font-semibold w-[10%]">Maand</th>
                    <th className="text-left px-4 py-3 font-semibold w-[12%]">Factuur Datum</th>
                    <th className="text-left px-4 py-3 font-semibold w-[12%]">Omschrijving</th>
                    <th className="text-right px-4 py-3 font-semibold w-[10%]">Bedrag</th>
                    <th className="text-center px-4 py-3 font-semibold w-[10%]">Status</th>
                    <th className="text-right px-4 py-3 font-semibold w-[16%]">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                        Geen facturen in deze categorie
                      </td>
                    </tr>
                  ) : (
                    invoices.map((invoice) => {
                        const tenant = getInvoiceTenant(invoice);
                        const displayName = tenant?.company_name || 'Onbekende huurder';
                        const hasLease = invoice.lease && invoice.lease.lease_spaces;

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
                            <td className="px-4 py-3 text-purple-600 font-medium text-sm">
                              {invoice.invoice_number.replace(/^INV-/, '')}
                            </td>
                            <td className="px-4 py-3 text-gray-300 text-sm">
                              {invoice.invoice_month ?
                                new Date(invoice.invoice_month + '-01').toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })
                              : '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-300 text-sm">
                              {new Date(invoice.invoice_date).toLocaleDateString('nl-NL')}
                            </td>
                            <td className="px-4 py-3 text-gray-300 text-sm">
                              {invoice.line_items && invoice.line_items.length > 0 ? (
                                (() => {
                                  const isMeetingRoomInvoice = invoice.notes?.toLowerCase().includes('vergaderruimte');
                                  const allLines = invoice.notes ? invoice.notes.split('\n').filter((line: string) => line.trim().startsWith('-')) : [];
                                  const bookingLines = allLines.filter((line: string) => !line.toLowerCase().includes('korting'));

                                  // If more than 10 booking lines in meeting room invoice, show summary
                                  if (isMeetingRoomInvoice && bookingLines.length > 10) {
                                    const totalAmount = bookingLines.reduce((sum, line) => {
                                      const amountMatch = line.match(/=\s*€([\d.]+)\s*$/);
                                      if (amountMatch) {
                                        return sum + parseFloat(amountMatch[1]);
                                      }
                                      return sum;
                                    }, 0);

                                    // Check for discount
                                    let hasDiscount = false;
                                    let discountPercentage = 0;
                                    allLines.forEach(line => {
                                      const discountMatch = line.match(/(\d+)%\s*huurderkorting/);
                                      if (discountMatch) {
                                        hasDiscount = true;
                                        discountPercentage = parseInt(discountMatch[1]);
                                      }
                                    });

                                    return (
                                      <div className="text-xs space-y-1">
                                        <div className="font-medium text-blue-400">Vergaderruimte boekingen</div>
                                        <div className="text-gray-400">
                                          {bookingLines.length} boekingen{hasDiscount ? ` (${discountPercentage}% korting)` : ''}
                                        </div>
                                      </div>
                                    );
                                  }

                                  // Show summary based on invoice notes
                                  // Check if this is a booking invoice by looking at notes
                                  const isBookingInvoice = invoice.notes &&
                                    (invoice.notes.includes('Vergaderruimte boekingen:') ||
                                     invoice.notes.includes('Flexwerkplek boekingen:'));

                                  if (isBookingInvoice) {
                                    // Count booking lines (lines that start with "- " but exclude discount lines)
                                    const allLines = invoice.notes.split('\n').filter(line => line.trim().startsWith('- '));
                                    const bookingCount = allLines.filter(line => !line.toLowerCase().includes('korting')).length;
                                    return (
                                      <div className="text-xs text-gray-400">
                                        {bookingCount} {bookingCount === 1 ? 'boeking' : 'boekingen'}
                                      </div>
                                    );
                                  }

                                  // For regular rental invoices, show space details
                                  return (
                                    <div className="text-xs text-gray-400 space-y-1">
                                      {invoice.line_items.slice(0, 3).map((item: any, idx: number) => (
                                        <div key={idx}>
                                          {item.description}
                                          {item.quantity > 0 && ` (${item.quantity} ${item.quantity_label || item.unit || 'm²'})`}
                                        </div>
                                      ))}
                                      {invoice.line_items.length > 3 && (
                                        <div className="text-gray-500">
                                          +{invoice.line_items.length - 3} meer
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="text-gray-100 font-bold">
                                €{invoice.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                                {getStatusLabel(invoice.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1 justify-end">
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
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ); };

          return (
            <div className="space-y-4">
              {/* Concept Huur Facturen */}
              {(invoiceTypeFilter === 'all' || invoiceTypeFilter === 'huur') && (
                <div>
                  {renderInvoiceTable(
                    draftHuurInvoices,
                    'Concept Huur Facturen',
                    '#10b981'
                  )}
                </div>
              )}

              {/* Concept Flex Facturen */}
              {(invoiceTypeFilter === 'all' || invoiceTypeFilter === 'flex') && (
                <div>
                  {renderInvoiceTable(
                    draftFlexInvoices,
                    'Concept Flex Facturen',
                    '#8b5cf6'
                  )}
                </div>
              )}

              {/* Concept Vergaderruimte Facturen */}
              {(invoiceTypeFilter === 'all' || invoiceTypeFilter === 'vergaderruimte') && (
                <div>
                  {renderInvoiceTable(
                    draftMeetingRoomInvoices,
                    'Concept Vergaderruimte Facturen',
                    '#3b82f6'
                  )}
                </div>
              )}

              {/* Concept Handgemaakte Facturen */}
              {(invoiceTypeFilter === 'all' || invoiceTypeFilter === 'handmatig') && (
                <div>
                  {renderInvoiceTable(
                    draftManualInvoices,
                    'Concept Handgemaakte Facturen',
                    '#f59e0b',
                    {
                      label: 'Nieuwe Factuur',
                      onClick: () => setShowForm(true),
                      color: 'bg-gold-500'
                    }
                  )}
                </div>
              )}

              {/* Open facturen */}
              <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700">
                <div className="flex items-center justify-between px-4 py-3 bg-dark-800 border-b border-amber-500">
                  <h2 className="text-lg font-bold text-gray-100">
                    Openstaande Facturen
                  </h2>
                  <div className="flex items-center gap-2">
                    {filteredOpenInvoices.filter(inv => selectedInvoices.has(inv.id)).length > 0 && (
                      <>
                        <div className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm">
                          <CheckSquare size={16} />
                          {filteredOpenInvoices.filter(inv => selectedInvoices.has(inv.id)).length} Geselecteerd
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
                  <table className="w-full table-fixed min-w-[1000px]">
                      <thead>
                        <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                          <th className="text-center px-4 py-3 font-semibold w-[5%]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectAll(filteredOpenInvoices);
                              }}
                              className="text-gray-300 hover:text-gold-500 transition-colors"
                            >
                              {selectedInvoices.size === filteredOpenInvoices.length && filteredOpenInvoices.length > 0 ? (
                                <CheckSquare size={18} />
                              ) : (
                                <Square size={18} />
                              )}
                            </button>
                          </th>
                          <th className="text-left px-4 py-3 font-semibold w-[19%]">Klant</th>
                          <th className="text-left px-4 py-3 font-semibold w-[10%]">Factuur Nr.</th>
                          <th className="text-left px-4 py-3 font-semibold w-[10%]">Maand</th>
                          <th className="text-left px-4 py-3 font-semibold w-[12%]">Factuur Datum</th>
                          <th className="text-left px-4 py-3 font-semibold w-[12%]">Vervaldatum</th>
                          <th className="text-right px-4 py-3 font-semibold w-[10%]">Bedrag</th>
                          <th className="text-center px-4 py-3 font-semibold w-[10%]">Status</th>
                          <th className="text-right px-4 py-3 font-semibold w-[16%]">Acties</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOpenInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                              Geen openstaande facturen
                            </td>
                          </tr>
                        ) : (
                          filteredOpenInvoices.map((invoice) => {
                            const tenant = getInvoiceTenant(invoice);
                            const displayName = tenant?.company_name || 'Onbekende huurder';
                            const hasLease = invoice.lease && invoice.lease.lease_spaces;

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
                                <td className="px-4 py-3 text-purple-600 font-medium text-sm">
                                  {invoice.invoice_number.replace(/^INV-/, '')}
                                </td>
                                <td className="px-4 py-3 text-gray-300 text-sm">
                                  {invoice.invoice_month ? (
                                    (() => {
                                      const [year, month] = invoice.invoice_month.split('-');
                                      const monthNames = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
                                      return `${monthNames[parseInt(month) - 1]} ${year}`;
                                    })()
                                  ) : '-'}
                                </td>
                                <td className="px-4 py-3 text-gray-300 text-sm">
                                  {new Date(invoice.invoice_date).toLocaleDateString('nl-NL')}
                                </td>
                                <td className="px-4 py-3 text-gray-300 text-sm">
                                  <div className="flex items-center gap-1">
                                    <Calendar size={14} className="text-gold-500" />
                                    {new Date(invoice.due_date).toLocaleDateString('nl-NL')}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="text-gray-100 font-bold">
                                    €{invoice.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                  {invoice.applied_credit > 0 && (
                                    <div className="text-xs text-green-400">
                                      -€{invoice.applied_credit.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} credit
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
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                </div>
              </div>
            </div>
          );
          })()}
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

        const customersWithBookings = targetMonth ? [...tenants, ...externalCustomers.map(ec => ({
          ...ec,
          isExternal: true
        }))].filter(customer => {
          const meetingBookings = meetingRoomBookings.filter(booking => {
            const bookingDate = new Date(booking.booking_date);
            const bookingYearMonth = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;
            const isForSelectedMonth = bookingYearMonth === targetMonth;
            const isUnbilled = !booking.invoice_id;
            const isCompleted = booking.status === 'completed';
            const isForCustomer = (customer as any).isExternal
              ? booking.external_customer_id === customer.id
              : booking.tenant_id === customer.id;
            return isForSelectedMonth && isUnbilled && isCompleted && isForCustomer;
          });

          const flexBookings = flexDayBookings.filter(booking => {
            const bookingDate = new Date(booking.booking_date);
            const bookingYearMonth = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;
            const isForSelectedMonth = bookingYearMonth === targetMonth;
            const isUnbilled = !booking.invoice_id;
            const isCompleted = booking.status === 'completed';
            const isForCustomer = (customer as any).isExternal
              ? booking.external_customer_id === customer.id
              : booking.tenant_id === customer.id;
            return isForSelectedMonth && isUnbilled && isCompleted && isForCustomer;
          });

          if (meetingBookings.length === 0 && flexBookings.length === 0) return false;

          const existingInvoice = invoices.find(inv => {
            const matchesCustomer = (customer as any).isExternal
              ? inv.external_customer_id === customer.id
              : inv.tenant_id === customer.id;
            return matchesCustomer && inv.invoice_month === targetMonth && !inv.lease_id;
          });

          return !existingInvoice;
        }) : [];

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-900 rounded-lg shadow-xl border border-dark-700 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-dark-800 px-6 py-4 border-b border-dark-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-100">
                  {invoiceTypeFilter === 'huur' && 'Huur Facturen Genereren'}
                  {invoiceTypeFilter === 'vergaderruimte' && 'Vergaderruimte Facturen Genereren'}
                  {invoiceTypeFilter === 'flex' && 'Flex Facturen Genereren'}
                  {invoiceTypeFilter === 'handmatig' && 'Handmatige Facturen Genereren'}
                  {!invoiceTypeFilter && 'Facturen Genereren'}
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

              <div className="p-6 space-y-4">
                {invoiceMonth && (regularLeasesToGenerate.length > 0 || flexLeasesToGenerate.length > 0 || customersWithBookings.length > 0) ? (
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
                          {invoiceTypeFilter === 'huur' && (
                            <p className="text-xs text-emerald-400">
                              Huur wordt vooraf gefactureerd
                            </p>
                          )}
                          {(invoiceTypeFilter === 'vergaderruimte' || invoiceTypeFilter === 'flex') && (
                            <p className="text-xs text-blue-400">
                              Boekingen worden achteraf gefactureerd
                            </p>
                          )}
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

                        {/* Huurcontracten Teller */}
                        {regularLeasesToGenerate.length > 0 && (
                          <div className="bg-dark-700 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-emerald-500 mb-1">
                              <Home size={16} />
                              <span className="text-sm font-medium">Huurcontracten</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-100">{Array.from(selectedLeases).filter(id => regularLeasesToGenerate.some(l => l.id === id)).length}</div>
                            <div className="text-xs text-gray-400">van {regularLeasesToGenerate.length} beschikbaar</div>
                          </div>
                        )}

                        {/* Flex Teller */}
                        {flexLeasesToGenerate.length > 0 && (
                          <div className="bg-dark-700 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-amber-500 mb-1">
                              <Zap size={16} />
                              <span className="text-sm font-medium">Flex contracten</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-100">{Array.from(selectedLeases).filter(id => flexLeasesToGenerate.some(l => l.id === id)).length}</div>
                            <div className="text-xs text-gray-400">van {flexLeasesToGenerate.length} beschikbaar</div>
                          </div>
                        )}

                        {/* Vergaderruimtes Teller */}
                        {customersWithBookings.length > 0 && (
                          <div className="bg-dark-700 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-blue-500 mb-1">
                              <Calendar size={16} />
                              <span className="text-sm font-medium">Vergaderruimtes</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-100">{selectedCustomers.size}</div>
                            <div className="text-xs text-gray-400">van {customersWithBookings.length} beschikbaar</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Gedetailleerde selectie - 3 kolommen naast elkaar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Huurcontracten */}
                      {regularLeasesToGenerate.length > 0 && (
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
                        {flexLeasesToGenerate.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Zap size={16} className="text-amber-500" />
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
                                        ? 'bg-amber-900/20 border-amber-700'
                                        : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedLeases.has(lease.id)}
                                      onChange={() => {}}
                                      className="w-4 h-4 rounded border-dark-600 text-amber-600 focus:ring-amber-500 flex-shrink-0"
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

                        {/* Vergaderruimte facturen */}
                        {customersWithBookings.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Calendar size={16} className="text-blue-500" />
                                Vergaderruimte boekingen ({customersWithBookings.length})
                              </h4>
                            </div>
                            <div className="flex gap-2 text-xs">
                              <button
                                onClick={() => selectAllCustomers(customersWithBookings.map(c => c.id))}
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
                              {customersWithBookings.map(customer => {
                                const customerMeetingBookings = meetingRoomBookings.filter(booking => {
                                  const bookingDate = new Date(booking.booking_date);
                                  const bookingYearMonth = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;
                                  const isForSelectedMonth = bookingYearMonth === targetMonth;
                                  const isUnbilled = !booking.invoice_id;
                                  const isCompleted = booking.status === 'completed';
                                  const isForCustomer = (customer as any).isExternal
                                    ? booking.external_customer_id === customer.id
                                    : booking.tenant_id === customer.id;
                                  return isForSelectedMonth && isUnbilled && isCompleted && isForCustomer;
                                });

                                const customerFlexBookings = flexDayBookings.filter(booking => {
                                  const bookingDate = new Date(booking.booking_date);
                                  const bookingYearMonth = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;
                                  const isForSelectedMonth = bookingYearMonth === targetMonth;
                                  const isUnbilled = !booking.invoice_id;
                                  const isCompleted = booking.status === 'completed';
                                  const isForCustomer = (customer as any).isExternal
                                    ? booking.external_customer_id === customer.id
                                    : booking.tenant_id === customer.id;
                                  return isForSelectedMonth && isUnbilled && isCompleted && isForCustomer;
                                });

                                const customerBookings = [...customerMeetingBookings, ...customerFlexBookings];

                                const total = customerBookings.reduce((sum, booking) => {
                                  return sum + booking.total_amount;
                                }, 0);

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
                                        {customerBookings.length} boeking{customerBookings.length > 1 ? 'en' : ''}
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

      {previewInvoice && !loadingPreview && (
        <InvoicePreview
          invoice={previewInvoice.invoice}
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
          onEdit={() => {
            setPreviewInvoice(null);
            startEditInvoice(previewInvoice.invoice);
          }}
          onMarkAsPaid={previewInvoice.invoice.status === 'sent' ? () => {
            markAsPaid(previewInvoice.invoice.id);
            setPreviewInvoice(null);
          } : undefined}
          onCreateCreditNote={onCreateCreditNote ? () => {
            const tenant = getInvoiceTenant(previewInvoice.invoice);
            if (tenant && onCreateCreditNote) {
              onCreateCreditNote(previewInvoice.invoice, tenant, previewInvoice.spaces);
              setPreviewInvoice(null);
            }
          } : undefined}
        />
      )}
    </div>
  );
});
