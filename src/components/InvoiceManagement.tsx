import { useState, useEffect } from 'react';
import { supabase, type Invoice, type Lease, type Tenant, type LeaseSpace, type OfficeSpace, type InvoiceLineItem } from '../lib/supabase';
import { Plus, FileText, Eye, Calendar, CheckCircle, Download, Trash2, Send, Edit } from 'lucide-react';
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
};

// Helper function to convert invoice line items to spaces with proper type detection
function convertLineItemsToSpaces(items: InvoiceLineItem[]) {
  return items.map(item => {
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

    return {
      space_name: item.description,
      monthly_rent: item.amount,
      space_type: spaceType as any,
      square_footage: squareFootage,
      price_per_sqm: item.unit_price
    };
  });
}

export function InvoiceManagement() {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [leases, setLeases] = useState<LeaseWithDetails[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [invoiceMode, setInvoiceMode] = useState<'lease' | 'manual'>('lease');
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [activeTab, setActiveTab] = useState<'draft' | 'open' | 'log'>('draft');
  const [previewInvoice, setPreviewInvoice] = useState<{
    invoice: InvoiceWithDetails;
    spaces: any[];
  } | null>(null);

  const getNextMonthString = async () => {
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

    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const finalMonth = nextMonth > 11 ? 0 : nextMonth;

    const result = `${nextYear}-${String(finalMonth + 1).padStart(2, '0')}`;
    console.log('Next month string:', result);

    return result;
  };

  const fetchMeetingRoomBookingsForMonth = async (tenantId: string, invoiceMonth: string) => {
    if (!invoiceMonth) return [];

    const [year, month] = invoiceMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const { data: bookings, error } = await supabase
      .from('meeting_room_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        total_hours,
        total_amount,
        hourly_rate,
        status,
        invoice_id,
        office_spaces(space_number)
      `)
      .eq('tenant_id', tenantId)
      .gte('booking_date', startDateStr)
      .lte('booking_date', endDateStr)
      .eq('status', 'confirmed')
      .is('invoice_id', null);

    if (error) {
      console.error('Error fetching meeting room bookings:', error);
      return [];
    }

    const groupedBookings = (bookings || []).reduce((acc, booking) => {
      const spaceName = booking.office_spaces?.space_number || 'Onbekende ruimte';
      if (!acc[spaceName]) {
        acc[spaceName] = {
          totalHours: 0,
          totalAmount: 0,
          hourlyRate: booking.hourly_rate || 0,
          bookingIds: []
        };
      }
      acc[spaceName].totalHours += parseFloat(booking.total_hours?.toString() || '0');
      acc[spaceName].totalAmount += parseFloat(booking.total_amount?.toString() || '0');
      acc[spaceName].bookingIds.push(booking.id);
      return acc;
    }, {} as Record<string, { totalHours: number; totalAmount: number; hourlyRate: number; bookingIds: string[] }>);

    return Object.entries(groupedBookings).map(([spaceName, data]) => ({
      description: `${spaceName} - Vergaderruimte (${data.totalHours.toFixed(1)} uur)`,
      unit_price: data.hourlyRate.toFixed(2),
      quantity: data.totalHours.toFixed(1),
      space_type: 'Meeting Room',
      bookingIds: data.bookingIds
    }));
  };

  const [formData, setFormData] = useState({
    lease_id: '',
    tenant_id: '',
    invoice_date: '',
    due_date: '',
    invoice_month: '',
    vat_rate: '21',
    vat_inclusive: false,
    notes: ''
  });

  const [lineItems, setLineItems] = useState<Array<{
    description: string;
    unit_price: string;
    quantity?: string;
    space_type?: string;
    bookingIds?: string[];
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
        tenant:tenants(*)
      `)
      .order('created_at', { ascending: false });

    setInvoices(invoicesData as InvoiceWithDetails[] || []);
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

  const startEditInvoice = async (invoice: InvoiceWithDetails) => {
    const { data: items } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice.id);

    if (items) {
      setLineItems(items.map(item => ({
        description: item.description,
        unit_price: item.amount.toString(),
        quantity: undefined
      })));
    }

    setFormData({
      lease_id: invoice.lease_id || '',
      tenant_id: invoice.tenant_id || '',
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      invoice_month: invoice.invoice_month || getNextMonthString(),
      vat_rate: invoice.vat_rate.toString(),
      vat_inclusive: invoice.vat_inclusive,
      notes: invoice.notes || ''
    });

    setInvoiceMode(invoice.lease_id ? 'lease' : 'manual');
    setEditingInvoiceId(invoice.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
          amount: quantity * unitPrice
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
          tenant:tenants(*)
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
          tenant_id: invoiceMode === 'manual' ? formData.tenant_id : null,
          invoice_number: invoiceNumber,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          invoice_month: formData.invoice_month || null,
          subtotal: subtotal,
          vat_amount: vatAmount,
          amount: total,
          vat_rate: vatRate,
          vat_inclusive: vatInclusive,
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
          amount: quantity * unitPrice
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
        .filter(item => item.bookingIds && item.bookingIds.length > 0)
        .flatMap(item => item.bookingIds || []);

      if (allBookingIds.length > 0) {
        const { error: bookingUpdateError } = await supabase
          .from('meeting_room_bookings')
          .update({ invoice_id: newInvoice.id })
          .in('id', allBookingIds);

        if (bookingUpdateError) {
          console.error('Error linking bookings to invoice:', bookingUpdateError);
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
          tenant:tenants(*)
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
      const items = lease.lease_spaces.map(ls => {
        const spaceName = ls.space.space_number;
        const spaceType = ls.space.space_type;
        const squareFootage = ls.space.square_footage;

        let displayName = spaceName;
        if (spaceType === 'bedrijfsruimte') {
          const numOnly = spaceName.replace(/^(Bedrijfsruimte|Hal)\s*/i, '').trim();
          if (/^\d+/.test(numOnly)) {
            displayName = `Hal ${numOnly}`;
          }
        }

        return {
          description: displayName,
          unit_price: ls.monthly_rent.toFixed(2),
          quantity: squareFootage || 1,
          space_type: spaceType
        };
      });

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
      const response = await fetch('/Logo.png');
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
        tenant_name: tenant?.name || '',
        tenant_company_name: tenant?.company_name || '',
        tenant_email: tenant?.email || '',
        tenant_phone: tenant?.phone || undefined,
        tenant_billing_address: tenant?.billing_address || undefined,
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
          const tenantFolderPath = `${companySettings.root_folder_path}/${tenant.company_name}`;
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

        const emailBody = `Beste ${tenant.name},

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
      console.error('Onjuiste code');
      return;
    }

    const { error: itemsError } = await supabase
      .from('invoice_line_items')
      .delete()
      .eq('invoice_id', invoiceId);

    if (itemsError) {
      console.error('Error deleting line items:', itemsError);
      return;
    }

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId);

    if (error) {
      console.error('Error deleting invoice:', error);
      return;
    }
    setShowDeleteConfirm(null);
    setDeletePassword('');

    // Update local state without full reload
    setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
  };

  const viewInvoiceDetails = async (invoice: InvoiceWithDetails) => {
    const { data: items } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice.id);

    setSelectedInvoice({ ...invoice, line_items: items } as any);
  };

  const resetForm = () => {
    setFormData({
      lease_id: '',
      tenant_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      invoice_month: getNextMonthString(),
      vat_rate: '21',
      vat_inclusive: false,
      notes: ''
    });
    setLineItems([]);
    setShowForm(false);
    setInvoiceMode('lease');
    setEditingInvoiceId(null);
  };

  const generateMeetingRoomInvoices = async () => {
    setGeneratingBulk(true);

    const { data: settings } = await supabase
      .from('company_settings')
      .select('test_mode, test_date')
      .maybeSingle();

    let currentDate = new Date();
    if (settings?.test_mode === true && settings?.test_date) {
      currentDate = new Date(settings.test_date);
    }

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const previousMonth = month === 0 ? 11 : month - 1;
    const previousYear = month === 0 ? year - 1 : year;
    const previousMonthString = `${previousYear}-${String(previousMonth + 1).padStart(2, '0')}`;

    const invoiceDate = currentDate.toISOString().split('T')[0];
    const dueDateObj = new Date(currentDate);
    dueDateObj.setDate(dueDateObj.getDate() + 14);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    const tenantsWithBookings = new Map<string, { tenant: Tenant; bookings: any[] }>();

    for (const tenant of tenants) {
      const bookingItems = await fetchMeetingRoomBookingsForMonth(tenant.id, previousMonthString);

      if (bookingItems.length > 0) {
        tenantsWithBookings.set(tenant.id, {
          tenant,
          bookings: bookingItems
        });
      }
    }

    let successCount = 0;
    let failCount = 0;

    for (const [tenantId, { tenant, bookings }] of tenantsWithBookings) {
      try {
        const existingInvoice = invoices.find(
          inv => inv.tenant_id === tenantId && inv.invoice_month === previousMonthString && inv.lease_id === null
        );

        if (existingInvoice) {
          continue;
        }

        const baseAmount = Math.round(bookings.reduce((sum, item) => {
          const quantity = item.quantity ? parseFloat(item.quantity) : 1;
          const unitPrice = parseFloat(item.unit_price);
          return sum + (quantity * unitPrice);
        }, 0) * 100) / 100;

        const { subtotal, vatAmount, total } = calculateVAT(baseAmount, 21, false);

        const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');

        const { data: newInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert([{
            lease_id: null,
            tenant_id: tenantId,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            due_date: dueDate,
            invoice_month: previousMonthString,
            subtotal: subtotal,
            vat_amount: vatAmount,
            amount: total,
            vat_rate: 21,
            vat_inclusive: false,
            status: 'draft',
            notes: 'Vergaderruimte gebruik'
          }])
          .select()
          .single();

        if (invoiceError) {
          console.error('Error creating meeting room invoice:', invoiceError);
          failCount++;
          continue;
        }

        const lineItemsToInsert = bookings.map(item => {
          const quantity = item.quantity ? parseFloat(item.quantity) : 1;
          const unitPrice = parseFloat(item.unit_price);
          return {
            invoice_id: newInvoice.id,
            description: item.description,
            quantity: quantity,
            unit_price: unitPrice,
            amount: quantity * unitPrice
          };
        });

        const { error: lineItemsError } = await supabase
          .from('invoice_line_items')
          .insert(lineItemsToInsert);

        if (lineItemsError) {
          console.error('Error creating line items:', lineItemsError);
          await supabase.from('invoices').delete().eq('id', newInvoice.id);
          failCount++;
          continue;
        }

        const allBookingIds = bookings
          .filter(item => item.bookingIds && item.bookingIds.length > 0)
          .flatMap(item => item.bookingIds || []);

        if (allBookingIds.length > 0) {
          await supabase
            .from('meeting_room_bookings')
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
            tenant:tenants(*)
          `)
          .eq('id', newInvoice.id)
          .single();

        if (fullInvoice) {
          setInvoices(prev => [fullInvoice as InvoiceWithDetails, ...prev]);
        }
      } catch (err) {
        console.error('Error generating meeting room invoice:', err);
        failCount++;
      }
    }

    setGeneratingBulk(false);
    alert(`Vergaderruimte facturen gegenereerd!\n\nSuccesvol: ${successCount}\nMislukt: ${failCount}`);
  };

  const generateBulkInvoices = async () => {
    setGeneratingBulk(true);

    const { data: settings } = await supabase
      .from('company_settings')
      .select('test_mode, test_date')
      .maybeSingle();

    let currentDate = new Date();
    if (settings?.test_mode === true && settings?.test_date) {
      currentDate = new Date(settings.test_date);
    }

    const nextMonth = await getNextMonthString();
    const invoiceDate = currentDate.toISOString().split('T')[0];
    const dueDateObj = new Date(currentDate);
    dueDateObj.setDate(dueDateObj.getDate() + 14);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    console.log('Starting bulk invoice generation for month:', nextMonth);
    console.log('Total leases to process:', leases.length);
    console.log('Leases:', leases.map(l => ({ id: l.id, tenant: l.tenant?.company_name })));

    let successCount = 0;
    let failCount = 0;

    for (const lease of leases) {
      try {
        console.log('Processing lease:', lease.id, 'Tenant:', lease.tenant?.company_name);

        const existingInvoice = invoices.find(
          inv => inv.lease_id === lease.id && inv.invoice_month === nextMonth
        );

        if (existingInvoice) {
          console.log('Skipping - invoice already exists for', lease.tenant?.company_name, 'month:', nextMonth);
          continue;
        }

        console.log('Creating invoice for', lease.tenant?.company_name, 'for month:', nextMonth);

        const { data: invoiceNumber, error: numberError } = await supabase.rpc('generate_invoice_number');

        if (numberError || !invoiceNumber) {
          console.error('Error generating invoice number:', numberError);
          failCount++;
          continue;
        }

        console.log('Generated invoice number:', invoiceNumber);

        const baseAmount = Math.round((lease.lease_spaces.reduce((sum, ls) => sum + ls.monthly_rent, 0) + lease.security_deposit) * 100) / 100;

        const { subtotal, vatAmount, total } = calculateVAT(
          baseAmount,
          lease.vat_rate,
          lease.vat_inclusive
        );

        const { data: newInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert([{
            lease_id: lease.id,
            tenant_id: null,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            due_date: dueDate,
            invoice_month: nextMonth,
            subtotal: subtotal,
            vat_amount: vatAmount,
            amount: total,
            vat_rate: lease.vat_rate,
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

        const lineItemsToInsert = [];

        for (const ls of lease.lease_spaces) {
          const spaceName = ls.space.space_number;
          const spaceType = ls.space.space_type;
          const squareFootage = ls.space.square_footage;

          let displayName = spaceName;
          if (spaceType === 'bedrijfsruimte') {
            const numOnly = spaceName.replace(/^(Bedrijfsruimte|Hal)\s*/i, '').trim();
            if (/^\d+/.test(numOnly)) {
              displayName = `Hal ${numOnly}`;
            }
          }

          lineItemsToInsert.push({
            invoice_id: newInvoice.id,
            description: displayName,
            quantity: squareFootage || 1,
            unit_price: ls.monthly_rent,
            amount: ls.monthly_rent
          });
        }

        if (lease.security_deposit > 0) {
          lineItemsToInsert.push({
            invoice_id: newInvoice.id,
            description: 'Voorschot Gas, Water & Electra',
            quantity: 1,
            unit_price: lease.security_deposit,
            amount: lease.security_deposit
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
              tenant:tenants(*)
            `)
            .eq('id', newInvoice.id)
            .single();

          if (fullInvoice) {
            setInvoices(prev => [fullInvoice as InvoiceWithDetails, ...prev]);
          }
        }
      } catch (error) {
        console.error('Error processing lease:', error);
        failCount++;
      }
    }

    setGeneratingBulk(false);
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

  const getInvoiceTenant = (invoice: InvoiceWithDetails) => {
    if (invoice.lease) {
      return invoice.lease.tenant;
    }
    return invoice.tenant;
  };


  const showInvoicePreview = async (invoice: InvoiceWithDetails) => {
    const { data: items } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice.id);

    const spaces = items ? convertLineItemsToSpaces(items) : [];

    setPreviewInvoice({ invoice, spaces });
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
      invoice_month: previewInvoice.invoice.invoice_month || undefined,
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

  if (loading) {
    return <div className="text-center py-8">Facturen laden...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-100">Facturen</h2>
        <div className="flex gap-2">
          {(activeTab === 'draft' || activeTab === 'open') && leases.length > 0 && (
            <>
              <button
                onClick={generateBulkInvoices}
                disabled={generatingBulk}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calendar size={20} />
                {generatingBulk ? 'Bezig...' : 'Huur Facturen'}
              </button>
              <button
                onClick={generateMeetingRoomInvoices}
                disabled={generatingBulk}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calendar size={20} />
                {generatingBulk ? 'Bezig...' : 'Vergaderruimte Facturen'}
              </button>
            </>
          )}
          {(activeTab === 'draft' || activeTab === 'open') && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
            >
              <Plus size={20} />
              Factuur Aanmaken
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-dark-700">
        <button
          onClick={() => setActiveTab('draft')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'draft'
              ? 'text-gold-500 border-b-2 border-gold-500'
              : 'text-gray-300 hover:text-gray-100'
          }`}
        >
          Concepten
        </button>
        <button
          onClick={() => setActiveTab('open')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'open'
              ? 'text-gold-500 border-b-2 border-gold-500'
              : 'text-gray-300 hover:text-gray-100'
          }`}
        >
          Openstaand
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'log'
              ? 'text-gold-500 border-b-2 border-gold-500'
              : 'text-gray-300 hover:text-gray-100'
          }`}
        >
          Logboek
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-2xl my-8 mx-4">
            <h3 className="text-xl font-bold text-gray-100 mb-4">
              {editingInvoiceId ? 'Factuur Bewerken' : 'Nieuwe Factuur Aanmaken'}
            </h3>

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
                      const totalMonthlyRent = Math.round((lease.lease_spaces.reduce((sum, ls) => sum + ls.monthly_rent, 0) + lease.security_deposit) * 100) / 100;
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

              {((invoiceMode === 'lease' && formData.lease_id) || (invoiceMode === 'manual' && formData.tenant_id)) && (
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
                    <div className="flex justify-between pt-2 border-t border-dark-700">
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
                    (invoiceMode === 'manual' && !formData.tenant_id)
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
      )}

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-900 rounded-lg p-8 w-full max-w-2xl my-8 mx-4">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-100 mb-2">
                Factuur {selectedInvoice.invoice_number}
              </h3>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedInvoice.status)}`}>
                {getStatusLabel(selectedInvoice.status)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Huurder</h4>
                {(() => {
                  const tenant = getInvoiceTenant(selectedInvoice);
                  return tenant ? (
                    <>
                      <p className="font-medium text-gray-100">{tenant.company_name}</p>
                      <p className="text-sm text-gray-300">{tenant.email}</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">Geen huurder gekoppeld</p>
                  );
                })()}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-2">
                  {selectedInvoice.lease ? 'Kantoorruimtes' : 'Type'}
                </h4>
                {selectedInvoice.lease ? (
                  selectedInvoice.lease.lease_spaces.map((ls) => (
                    <p key={ls.id} className="text-sm text-gray-100">{ls.space.space_number}</p>
                  ))
                ) : (
                  <p className="text-sm text-gray-300">Handmatig samengesteld</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-1">Factuurdatum</h4>
                <p className="text-gray-100">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-1">Vervaldatum</h4>
                <p className="text-gray-100">{new Date(selectedInvoice.due_date).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Factuurregels</h4>
              <table className="w-full">
                <thead className="bg-gold-500">
                  <tr>
                    <th className="text-left px-4 py-2 text-sm font-medium text-white">OMSCHRIJVING</th>
                    <th className="text-right px-4 py-2 text-sm font-medium text-white">BEDRAG</th>
                    <th className="text-right px-4 py-2 text-sm font-medium text-white">BTW</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice as any).line_items?.map((item: InvoiceLineItem, index: number) => (
                    <tr key={item.id} className={index % 2 === 0 ? 'bg-dark-800' : 'bg-dark-900'}>
                      <td className="px-4 py-2 text-gray-100">{item.description}</td>
                      <td className="text-right px-4 py-2 text-gray-100">€{item.amount.toFixed(2)}</td>
                      <td className="text-right px-4 py-2 text-gray-100">{selectedInvoice.vat_rate.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 bg-dark-800 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-300">Subtotaal (excl. BTW):</span>
                  <span className="font-medium text-gray-100">€{selectedInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-gray-300">BTW ({selectedInvoice.vat_rate.toFixed(0)}%):</span>
                  <span className="font-medium text-gray-100">€{selectedInvoice.vat_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-3 border-t-2 border-gold-500">
                  <span className="font-bold text-lg text-gray-100">Totaal te betalen:</span>
                  <span className="font-bold text-lg text-gray-100">€{selectedInvoice.amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {selectedInvoice.notes && (
              <div className="mb-6 p-4 bg-dark-800 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-300 mb-1">Notities</h4>
                <p className="text-sm text-gray-200">{selectedInvoice.notes}</p>
              </div>
            )}

            <div className="flex gap-2">
              {selectedInvoice.status !== 'paid' && (
                <button
                  onClick={async () => {
                    await sendInvoiceEmail(selectedInvoice.id);
                    setSelectedInvoice(null);
                  }}
                  className="flex-1 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Send size={24} />
                  {selectedInvoice.status === 'draft' ? 'Verzenden via Email' : 'Opnieuw Verzenden'}
                </button>
              )}
              {selectedInvoice.status !== 'paid' && (
                <button
                  onClick={async () => {
                    await markAsPaid(selectedInvoice.id);
                    setSelectedInvoice(null);
                  }}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Markeer als Betaald
                </button>
              )}
              {selectedInvoice.status !== 'paid' && (
                <button
                  onClick={() => {
                    setSelectedInvoice(null);
                    setShowDeleteConfirm(selectedInvoice.id);
                  }}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Verwijderen
                </button>
              )}
              <button
                onClick={() => setSelectedInvoice(null)}
                className="flex-1 bg-dark-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-700 transition-colors"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'draft' && (
        <div className="space-y-8">
          {(() => {
            let groupedInvoices = invoices.filter(inv => inv.status === 'draft');

            if (groupedInvoices.length === 0) return (
              <div className="text-center py-12 text-gray-400">
                Geen conceptfacturen gevonden.
              </div>
            );

            groupedInvoices = groupedInvoices.sort((a, b) => {
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
            });

          return (
            <div>
              <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-dark-600">
                <h2 className="text-xl font-bold text-gray-100">
                  Concept Facturen
                </h2>
              </div>
              <div className="space-y-3">
                {groupedInvoices.map((invoice) => {
                  const tenant = getInvoiceTenant(invoice);
                  const displayName = tenant?.company_name || 'Onbekende huurder';
                  const hasLease = invoice.lease && invoice.lease.lease_spaces;

                  return (
                    <div
                      key={invoice.id}
                      className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <FileText className="text-gray-500" size={24} />
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-semibold text-gray-100">
                                {displayName}
                              </h3>
                              <span className="text-sm font-medium text-purple-600">
                                {invoice.invoice_number.replace(/^INV-/, '')}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                                {getStatusLabel(invoice.status)}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-300">
                              {hasLease && (
                                <>
                                  <span>{invoice.lease!.lease_spaces.length} {invoice.lease!.lease_spaces.length === 1 ? 'ruimte' : 'ruimtes'}</span>
                                  <span>•</span>
                                </>
                              )}
                              {!hasLease && (
                                <>
                                  <span className="text-gray-400 italic">Handmatig</span>
                                  <span>•</span>
                                </>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar size={14} />
                                Vervalt {new Date(invoice.due_date).toLocaleDateString('nl-NL')}
                              </span>
                              {invoice.invoice_month && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {(() => {
                                      const [year, month] = invoice.invoice_month.split('-');
                                      const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
                                      return monthNames[parseInt(month) - 1];
                                    })()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xl font-bold text-gray-100">
                              €{invoice.amount.toFixed(2)}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditInvoice(invoice)}
                              className="flex items-center gap-1 text-blue-500 hover:text-blue-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                              title="Bewerken"
                            >
                              <Edit size={24} />
                            </button>
                            <button
                              onClick={() => showInvoicePreview(invoice)}
                              className="flex items-center gap-1 text-gold-500 hover:text-gold-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                            >
                              <Eye size={24} />
                            </button>
                            <button
                              onClick={async () => {
                                const { data: items } = await supabase
                                  .from('invoice_line_items')
                                  .select('*')
                                  .eq('invoice_id', invoice.id);

                                const spaces = items ? convertLineItemsToSpaces(items) : [];

                                generateInvoicePDF({
                                  invoice_number: invoice.invoice_number,
                                  tenant_name: tenant?.name || '',
                                  tenant_company_name: tenant?.company_name || '',
                                  tenant_email: tenant?.email || '',
                                  tenant_phone: tenant?.phone || undefined,
                                  tenant_billing_address: tenant?.billing_address || undefined,
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
                              }}
                              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-emerald-900"
                            >
                              <Download size={24} />
                            </button>
                            {invoice.status === 'draft' && (
                              <>
                                <button
                                  onClick={() => sendInvoiceEmail(invoice.id)}
                                  className="flex items-center gap-1 text-gold-500 hover:text-gold-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                                >
                                  <Send size={24} />
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(invoice.id)}
                                  className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-900"
                                >
                                  <Trash2 size={24} />
                                </button>
                              </>
                            )}
                            {invoice.status === 'sent' && (
                              <>
                                <button
                                  onClick={() => markAsPaid(invoice.id)}
                                  className="flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-green-900"
                                >
                                  <CheckCircle size={24} />
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(invoice.id)}
                                  className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-900"
                                >
                                  <Trash2 size={24} />
                                </button>
                              </>
                            )}
                            {invoice.status === 'paid' && (
                              <button
                                onClick={() => setShowDeleteConfirm(invoice.id)}
                                className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-900"
                              >
                                <Trash2 size={24} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
          })()}
        </div>
      )}

      {activeTab === 'open' && (
        <div className="space-y-8">
          {(() => {
            let groupedInvoices = invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'draft');

            if (groupedInvoices.length === 0) return (
              <div className="text-center py-12 text-gray-400">
                Geen openstaande facturen gevonden.
              </div>
            );

            groupedInvoices = groupedInvoices.sort((a, b) => {
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
            });

          return (
            <div>
              <h2 className="text-xl font-bold text-gray-100 mb-4 pb-2 border-b-2 border-orange-500">
                Openstaande Facturen
              </h2>
              <div className="space-y-3">
                {groupedInvoices.map((invoice) => {
                  const tenant = getInvoiceTenant(invoice);
                  const displayName = tenant?.company_name || 'Onbekende huurder';
                  const hasLease = invoice.lease && invoice.lease.lease_spaces;

                  return (
                    <div
                      key={invoice.id}
                      className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <FileText className="text-gray-500" size={24} />
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-semibold text-gray-100">
                                {displayName}
                              </h3>
                              <span className="text-sm font-medium text-purple-600">
                                {invoice.invoice_number.replace(/^INV-/, '')}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                                {getStatusLabel(invoice.status)}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-300">
                              {hasLease && (
                                <>
                                  <span>{invoice.lease!.lease_spaces.length} {invoice.lease!.lease_spaces.length === 1 ? 'ruimte' : 'ruimtes'}</span>
                                  <span>•</span>
                                </>
                              )}
                              {!hasLease && (
                                <>
                                  <span className="text-gray-400 italic">Handmatig</span>
                                  <span>•</span>
                                </>
                              )}
                              <span>Factuur: {new Date(invoice.invoice_date).toLocaleDateString('nl-NL')}</span>
                              <span>•</span>
                              <span>Vervaldatum: {new Date(invoice.due_date).toLocaleDateString('nl-NL')}</span>
                              {invoice.invoice_month && (
                                <>
                                  <span>•</span>
                                  <span>Maand: {new Date(invoice.invoice_month + '-01').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-gray-100">
                              € {invoice.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-dark-700">
                        <button
                          onClick={() => showInvoicePreview(invoice)}
                          className="flex items-center gap-1 text-gold-500 hover:text-gold-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                        >
                          <Eye size={24} />
                        </button>
                        <button
                          onClick={async () => {
                            const { data: items } = await supabase
                              .from('invoice_line_items')
                              .select('*')
                              .eq('invoice_id', invoice.id);

                            const spaces = items ? convertLineItemsToSpaces(items) : [];

                            const tenant = getInvoiceTenant(invoice);

                            generateInvoicePDF({
                              invoice_number: invoice.invoice_number,
                              tenant_name: tenant?.name || '',
                              tenant_company_name: tenant?.company_name || '',
                              tenant_email: tenant?.email || '',
                              tenant_phone: tenant?.phone || undefined,
                              tenant_billing_address: tenant?.billing_address || undefined,
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
                          }}
                          className="flex items-center gap-1 text-gold-500 hover:text-gold-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                        >
                          <Download size={24} />
                        </button>
                        {invoice.status === 'draft' && (
                          <>
                            <button
                              onClick={() => sendInvoiceEmail(invoice.id)}
                              className="flex items-center gap-1 text-purple-600 hover:text-purple-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-purple-50"
                            >
                              <Send size={24} />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(invoice.id)}
                              className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-900"
                            >
                              <Trash2 size={24} />
                            </button>
                          </>
                        )}
                        {invoice.status === 'sent' && (
                          <>
                            <button
                              onClick={() => markAsPaid(invoice.id)}
                              className="flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-green-900"
                            >
                              <CheckCircle size={24} />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(invoice.id)}
                              className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-900"
                            >
                              <Trash2 size={24} />
                            </button>
                          </>
                        )}
                        {invoice.status === 'paid' && (
                          <button
                            onClick={() => setShowDeleteConfirm(invoice.id)}
                            className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-900"
                          >
                            <Trash2 size={24} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
          })()}
        </div>
      )}

      {activeTab === 'log' && (
        <div className="space-y-6">
          {(() => {
            const paidInvoices = invoices.filter(inv => inv.status === 'paid');

            if (paidInvoices.length === 0) {
              return (
                <div className="text-center py-12 text-gray-400">
                  Nog geen betaalde facturen in het logboek.
                </div>
              );
            }

            const sortedInvoices = paidInvoices.sort((a, b) => {
              const tenantA = getInvoiceTenant(a);
              const tenantB = getInvoiceTenant(b);

              if (tenantA && tenantB) {
                const nameCompare = tenantA.company_name.localeCompare(tenantB.company_name);
                if (nameCompare !== 0) return nameCompare;
              }

              return new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime();
            });

            const groupedByTenant: { [key: string]: InvoiceWithDetails[] } = {};

            sortedInvoices.forEach(invoice => {
              const tenant = getInvoiceTenant(invoice);
              const tenantKey = tenant?.id || 'unknown';
              if (!groupedByTenant[tenantKey]) {
                groupedByTenant[tenantKey] = [];
              }
              groupedByTenant[tenantKey].push(invoice);
            });

            return Object.entries(groupedByTenant).map(([tenantKey, tenantInvoices]) => {
              const tenant = getInvoiceTenant(tenantInvoices[0]);
              const displayName = tenant?.company_name || 'Onbekende huurder';

              return (
                <div key={tenantKey}>
                  <h3 className="text-lg font-bold text-gray-100 mb-3 pb-2 border-b-2 border-emerald-500">
                    {displayName}
                  </h3>
                  <div className="space-y-3">
                    {tenantInvoices.map((invoice) => {
                      const tenant = getInvoiceTenant(invoice);
                      const hasLease = invoice.lease && invoice.lease.lease_spaces;

                      return (
                        <div
                          key={invoice.id}
                          className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-5 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <FileText className="text-gray-500" size={24} />
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <span className="text-sm font-medium text-purple-600">
                                    {invoice.invoice_number.replace(/^INV-/, '')}
                                  </span>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                                    {getStatusLabel(invoice.status)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-300">
                                  {hasLease && (
                                    <>
                                      <span>{invoice.lease!.lease_spaces.length} {invoice.lease!.lease_spaces.length === 1 ? 'ruimte' : 'ruimtes'}</span>
                                      <span>•</span>
                                    </>
                                  )}
                                  {!hasLease && (
                                    <>
                                      <span className="text-gray-400 italic">Handmatig</span>
                                      <span>•</span>
                                    </>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Calendar size={14} />
                                    {new Date(invoice.invoice_date).toLocaleDateString('nl-NL')}
                                  </span>
                                  {invoice.invoice_month && (
                                    <>
                                      <span>•</span>
                                      <span>
                                        {(() => {
                                          const [year, month] = invoice.invoice_month.split('-');
                                          const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
                                          return monthNames[parseInt(month) - 1];
                                        })()}
                                      </span>
                                    </>
                                  )}
                                  {invoice.paid_at && (
                                    <>
                                      <span>•</span>
                                      <span className="text-green-600">
                                        Betaald op {new Date(invoice.paid_at).toLocaleDateString('nl-NL')}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-xl font-bold text-gray-100">
                                  €{invoice.amount.toFixed(2)}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => showInvoicePreview(invoice)}
                                  className="flex items-center gap-1 text-gold-500 hover:text-gold-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                                >
                                  <Eye size={24} />
                                </button>
                                <button
                                  onClick={async () => {
                                    const { data: items } = await supabase
                                      .from('invoice_line_items')
                                      .select('*')
                                      .eq('invoice_id', invoice.id);

                                    const spaces = items ? convertLineItemsToSpaces(items) : [];

                                    generateInvoicePDF({
                                      invoice_number: invoice.invoice_number,
                                      tenant_name: tenant?.name || '',
                                      tenant_company_name: tenant?.company_name || '',
                                      tenant_email: tenant?.email || '',
                                      tenant_phone: tenant?.phone || undefined,
                                      tenant_billing_address: tenant?.billing_address || undefined,
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
                                  }}
                                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-emerald-900"
                                >
                                  <Download size={24} />
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(invoice.id)}
                                  className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-900"
                                >
                                  <Trash2 size={24} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-100 mb-4">Factuur Wissen</h3>
            <p className="text-gray-300 mb-4">
              Weet je zeker dat je deze betaalde factuur wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Voer code in:
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-3 py-2 border border-dark-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Code"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(null);
                  setDeletePassword('');
                }}
                className="flex-1 px-4 py-2 border border-dark-600 text-gray-200 rounded-lg hover:bg-dark-800 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={() => deleteInvoice(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Wissen
              </button>
            </div>
          </div>
        </div>
      )}

      {previewInvoice && (
        <InvoicePreview
          invoice={previewInvoice.invoice}
          tenant={getInvoiceTenant(previewInvoice.invoice) || {
            name: '',
            company_name: '',
            email: ''
          }}
          spaces={previewInvoice.spaces}
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
        />
      )}
    </div>
  );
}
