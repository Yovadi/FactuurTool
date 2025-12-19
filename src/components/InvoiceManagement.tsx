import { useState, useEffect } from 'react';
import { supabase, type Invoice, type Lease, type Tenant, type ExternalCustomer, type LeaseSpace, type OfficeSpace, type InvoiceLineItem } from '../lib/supabase';
import { Plus, FileText, Eye, Calendar, CheckCircle, Download, Trash2, Send, Edit, Search, CreditCard as Edit2, AlertCircle, CheckSquare, Square, Check, X } from 'lucide-react';
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

    if (item.description.toLowerCase().includes('voorschot')) {
      spaceType = 'voorschot';
    } else if (item.description.startsWith('Hal ')) {
      spaceType = 'bedrijfsruimte';
      isKnownSpaceType = true;
    } else if (item.description.startsWith('Kantoor ')) {
      spaceType = 'kantoor';
      isKnownSpaceType = true;
    } else if (item.description.startsWith('Buitenterrein ')) {
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

    if (isMeetingRoom) {
      if (item.quantity !== null && item.quantity !== undefined) {
        const parsed = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
        if (!isNaN(parsed) && parsed > 0) {
          hours = parsed;
          hourlyRate = item.unit_price;
        }
      }
    } else if (isKnownSpaceType && item.quantity !== null && item.quantity !== undefined) {
      const parsed = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
      if (!isNaN(parsed) && parsed > 0) {
        squareFootage = parsed;
        pricePerSqm = item.unit_price;
      }
    }

    return {
      space_name: item.description,
      monthly_rent: item.amount,
      space_type: spaceType as any,
      square_footage: squareFootage,
      price_per_sqm: pricePerSqm,
      hours: hours,
      hourly_rate: hourlyRate
    };
  });
}

type InvoiceManagementProps = {
  onCreateCreditNote?: (invoice: any, tenant: any, spaces: any[]) => void;
};

export function InvoiceManagement({ onCreateCreditNote }: InvoiceManagementProps = {}) {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [leases, setLeases] = useState<LeaseWithDetails[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [invoiceMode, setInvoiceMode] = useState<'lease' | 'manual'>('lease');
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<{
    invoice: InvoiceWithDetails;
    spaces: any[];
  } | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

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

  const fetchMeetingRoomBookingsForMonth = async (customerId: string, invoiceMonth: string, customerType: 'tenant' | 'external' = 'tenant') => {
    if (!invoiceMonth) return [];

    const [year, month] = invoiceMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log('Fetching bookings for customer:', customerId, 'type:', customerType);
    console.log('Date range:', startDateStr, 'to', endDateStr);

    let query = supabase
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
      .gte('booking_date', startDateStr)
      .lte('booking_date', endDateStr)
      .eq('status', 'completed')
      .is('invoice_id', null);

    if (customerType === 'tenant') {
      query = query.eq('tenant_id', customerId);
    } else {
      query = query.eq('external_customer_id', customerId);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error('Error fetching meeting room bookings:', error);
      return [];
    }

    console.log('Raw bookings found:', bookings?.length || 0, bookings);

    return (bookings || []).map(booking => {
      const spaceName = booking.office_spaces?.space_number || 'Onbekende ruimte';
      const bookingDate = new Date(booking.booking_date).toLocaleDateString('nl-NL');
      const totalHours = parseFloat(booking.total_hours?.toString() || '0');

      return {
        description: `${spaceName} - ${bookingDate} (${totalHours.toFixed(1)} uur)`,
        unit_price: (booking.hourly_rate || 0).toFixed(2),
        quantity: totalHours.toFixed(1),
        space_type: 'Meeting Room',
        bookingId: booking.id
      };
    });
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
    bookingId?: string;
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
        tenant:tenants(*),
        external_customer:external_customers(*),
        line_items:invoice_line_items(*)
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
        unit_price: item.unit_price.toString(),
        quantity: item.quantity.toString(),
        bookingId: item.booking_id || undefined
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

    if (invoiceMode === 'lease' && !formData.lease_id) {
      alert('Selecteer een huurcontract');
      return;
    }

    if (invoiceMode === 'manual' && !formData.tenant_id) {
      alert('Selecteer een huurder');
      return;
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
            unit_price: ls.price_per_sqm.toFixed(2),
            quantity: squareFootage || 1,
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
      setDeleteError('Onjuiste code. Probeer opnieuw.');
      setDeletePassword('');
      return;
    }

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
  };

  const viewInvoiceDetails = async (invoice: InvoiceWithDetails) => {
    const { data: items } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice.id);

    const spaces = convertLineItemsToSpaces(items || []);
    setPreviewInvoice({ invoice: { ...invoice, line_items: items } as any, spaces });
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

    // Use current month instead of previous month for meeting room bookings
    const invoiceMonthString = `${year}-${String(month + 1).padStart(2, '0')}`;

    console.log('=== MEETING ROOM INVOICE GENERATION ===');
    console.log('Generating meeting room invoices for month:', invoiceMonthString);
    console.log('Current date:', currentDate.toISOString());
    console.log('Total tenants:', tenants.length);
    console.log('Test mode:', settings?.test_mode);

    const invoiceDate = currentDate.toISOString().split('T')[0];
    const dueDateObj = new Date(currentDate);
    dueDateObj.setDate(dueDateObj.getDate() + 14);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    const customersWithBookings = new Map<string, { customer: any; customerType: 'tenant' | 'external'; bookings: any[] }>();

    for (const tenant of tenants) {
      console.log('Checking tenant:', tenant.company_name, 'ID:', tenant.id);
      const bookingItems = await fetchMeetingRoomBookingsForMonth(tenant.id, invoiceMonthString, 'tenant');
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

    console.log('External customers found:', externalCustomers?.length || 0);

    for (const customer of externalCustomers || []) {
      console.log('Checking external customer:', customer.company_name, 'ID:', customer.id);
      const bookingItems = await fetchMeetingRoomBookingsForMonth(customer.id, invoiceMonthString, 'external');
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
            inv => inv.tenant_id === customer.id && inv.invoice_month === invoiceMonthString && inv.lease_id === null
          );
        } else {
          existingInvoice = invoices.find(
            inv => inv.external_customer_id === customer.id && inv.invoice_month === invoiceMonthString && inv.lease_id === null
          );
        }

        if (existingInvoice) {
          console.log('Invoice already exists for customer:', customer.company_name);
          failCount++;
          continue;
        }

        const baseAmount = Math.round(bookings.reduce((sum, item) => {
          const quantity = item.quantity ? parseFloat(item.quantity) : 1;
          const unitPrice = parseFloat(item.unit_price);
          return sum + (quantity * unitPrice);
        }, 0) * 100) / 100;

        const { subtotal, vatAmount, total } = calculateVAT(baseAmount, 21, false);

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
          invoice_month: invoiceMonthString,
          subtotal: subtotal,
          vat_amount: vatAmount,
          amount: total,
          vat_rate: 21,
          vat_inclusive: false,
          status: 'draft',
          notes: 'Vergaderruimte boekingen'
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

        const lineItemsToInsert = bookings.map(item => {
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
          await supabase.from('invoices').delete().eq('id', newInvoice.id);
          failCount++;
          continue;
        }

        const allBookingIds = bookings
          .filter(item => item.bookingId)
          .map(item => item.bookingId);

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
      } catch (err) {
        console.error('Error generating meeting room invoice:', err);
        failCount++;
      }
    }

    setGeneratingBulk(false);

    console.log('=== GENERATION COMPLETE ===');
    console.log(`Success: ${successCount}, Failed: ${failCount}`);

    if (successCount > 0) {
      await loadInvoices();
    }
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

        let rentAmount = 0;
        const lineItemsToInsert = [];

        if (lease.lease_type === 'flex') {
          if (lease.flex_pricing_model === 'monthly') {
            rentAmount = lease.flex_monthly_rate || 0;
            lineItemsToInsert.push({
              invoice_id: '',
              description: 'Flexplek - Maandelijks tarief',
              quantity: 1,
              unit_price: rentAmount,
              amount: rentAmount
            });
          } else if (lease.flex_pricing_model === 'daily') {
            const [year, month] = nextMonth.split('-').map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();
            const workingDays = Math.round(daysInMonth * (5/7));
            rentAmount = (lease.flex_daily_rate || 0) * workingDays;
            lineItemsToInsert.push({
              invoice_id: '',
              description: `Flexplek - Dagelijks tarief (${workingDays} werkdagen)`,
              quantity: workingDays,
              unit_price: lease.flex_daily_rate || 0,
              amount: rentAmount
            });
          } else if (lease.flex_pricing_model === 'credits') {
            const creditsPerWeek = (lease as any).credits_per_week || 0;
            const weeksInMonth = 4.33;
            const monthlyCredits = Math.round(creditsPerWeek * weeksInMonth);
            rentAmount = monthlyCredits * (lease.flex_credit_rate || 0);
            lineItemsToInsert.push({
              invoice_id: '',
              description: `Flexplek - ${creditsPerWeek} dagen/week (≈${monthlyCredits} dagen/maand)`,
              quantity: monthlyCredits,
              unit_price: lease.flex_credit_rate || 0,
              amount: rentAmount
            });
          }
        } else {
          rentAmount = lease.lease_spaces.reduce((sum, ls) => sum + ls.monthly_rent, 0);
        }

        const baseAmount = Math.round((rentAmount + lease.security_deposit) * 100) / 100;

        const { subtotal, vatAmount, total } = calculateVAT(
          baseAmount,
          lease.vat_rate,
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

        if (lease.lease_type !== 'flex') {
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
              unit_price: ls.price_per_sqm,
              amount: ls.monthly_rent
            });
          }
        } else {
          lineItemsToInsert.forEach(item => {
            item.invoice_id = newInvoice.id;
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
    const { data: items, error } = await supabase
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

    console.log('Loaded line items:', items);
    const spaces = convertLineItemsToSpaces(items || []);
    setPreviewInvoice({ invoice: { ...invoice, line_items: items } as any, spaces });
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
    if (!window.confirm(`Weet je zeker dat je ${selectedInvoices.size} facturen wilt verwijderen?`)) return;

    const idsToDelete = Array.from(selectedInvoices);

    for (const id of idsToDelete) {
      await supabase.from('invoices').delete().eq('id', id);
    }

    await fetchInvoices();
    setSelectedInvoices(new Set());
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
    <div>

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
        </div>
      )}


      <div className="space-y-8">
        {(() => {
          const allDraftInvoices = invoices.filter(inv => inv.status === 'draft');

          // Categorize draft invoices
          const draftLeaseInvoices = allDraftInvoices
            .filter(inv => inv.lease_id !== null)
            .sort((a, b) => {
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

          const draftMeetingRoomInvoices = allDraftInvoices
            .filter(inv => inv.lease_id === null && (inv.notes?.includes('Vergaderruimte gebruik') || inv.notes?.includes('Vergaderruimte boekingen')))
            .sort((a, b) => {
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

          const draftManualInvoices = allDraftInvoices
            .filter(inv => inv.lease_id === null && !inv.notes?.includes('Vergaderruimte gebruik') && !inv.notes?.includes('Vergaderruimte boekingen'))
            .sort((a, b) => {
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

            const openInvoices = invoices
              .filter(inv => inv.status !== 'paid' && inv.status !== 'draft')
              .sort((a, b) => {
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

          const renderInvoiceTable = (invoices: typeof draftLeaseInvoices, title: string, borderColor: string, buttonConfig?: { label: string; onClick: () => void; color: string; disabled?: boolean }) => {
            const selectedInThisTable = invoices.filter(inv => selectedInvoices.has(inv.id)).length;
            return (
            <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
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
                    <th className="text-left px-4 py-3 font-semibold w-[15%]">Klant</th>
                    <th className="text-left px-4 py-3 font-semibold w-[8%]">Factuur Nr.</th>
                    <th className="text-left px-4 py-3 font-semibold w-[20%]">Omschrijving</th>
                    <th className="text-left px-4 py-3 font-semibold w-[8%]">Maand</th>
                    <th className="text-left px-4 py-3 font-semibold w-[10%]">Factuur Datum</th>
                    <th className="text-left px-4 py-3 font-semibold w-[10%]">Vervaldatum</th>
                    <th className="text-right px-4 py-3 font-semibold w-[8%]">Bedrag</th>
                    <th className="text-center px-4 py-3 font-semibold w-[8%]">Status</th>
                    <th className="text-right px-4 py-3 font-semibold w-[13%]">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
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
                              {invoice.line_items && invoice.line_items.length > 0 ? (
                                <div className="space-y-1">
                                  {invoice.line_items.map((item: any, idx: number) => (
                                    <div key={idx} className="text-xs">
                                      {item.description}
                                    </div>
                                  ))}
                                </div>
                              ) : '-'}
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
                              <div className="flex items-center gap-1">
                                <Calendar size={14} className="text-gold-500" />
                                {new Date(invoice.due_date).toLocaleDateString('nl-NL')}
                              </div>
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
            <div>
              {/* Concept Huur Facturen */}
              {renderInvoiceTable(
                draftLeaseInvoices,
                'Concept Huur Facturen',
                '#10b981',
                {
                  label: generatingBulk ? 'Bezig...' : 'Genereer factuur',
                  onClick: generateBulkInvoices,
                  color: 'bg-emerald-600',
                  disabled: generatingBulk
                }
              )}

              {/* Concept Vergaderruimte Facturen */}
              <div className="mt-8">
                {renderInvoiceTable(
                  draftMeetingRoomInvoices,
                  'Concept Vergaderruimte Facturen',
                  '#3b82f6',
                  {
                    label: generatingBulk ? 'Bezig...' : 'Genereer factuur',
                    onClick: generateMeetingRoomInvoices,
                    color: 'bg-blue-600',
                    disabled: generatingBulk
                  }
                )}
              </div>

              {/* Concept Handgemaakte Facturen */}
              <div className="mt-8">
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

              <div className="mt-8 bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-dark-800 border-b border-amber-500">
                  <h2 className="text-lg font-bold text-gray-100">
                    Openstaande Facturen
                  </h2>
                  <div className="flex items-center gap-2">
                    {openInvoices.filter(inv => selectedInvoices.has(inv.id)).length > 0 && (
                      <>
                        <div className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm">
                          <CheckSquare size={16} />
                          {openInvoices.filter(inv => selectedInvoices.has(inv.id)).length} Geselecteerd
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
                    <table className="w-full table-fixed min-w-[1000px]">
                      <thead>
                        <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                          <th className="text-center px-4 py-3 font-semibold w-[5%]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectAll(openInvoices);
                              }}
                              className="text-gray-300 hover:text-gold-500 transition-colors"
                            >
                              {selectedInvoices.size === openInvoices.length && openInvoices.length > 0 ? (
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
                        {openInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                              Geen openstaande facturen
                            </td>
                          </tr>
                        ) : (
                          openInvoices.map((invoice) => {
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
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-6 max-w-md w-full mx-4 border border-dark-700">
            <h3 className="text-xl font-bold text-gray-100 mb-4">Factuur Wissen</h3>
            <p className="text-gray-300 mb-4">
              Weet je zeker dat je deze factuur wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
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

      {previewInvoice && (
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
}
