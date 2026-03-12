import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building, Users, AlertCircle, Calendar, Clock, CalendarClock, FileText, DollarSign, CheckCircle, Check, XCircle, AlertTriangle, Home, Zap, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { SkeletonDashboard } from './SkeletonLoader';
import { createAdminNotification } from '../utils/notificationHelper';
import { useUnbilledItems } from './UnbilledItemsReminder';

type DashboardStats = {
  totalTenants: number;
  totalSpaces: number;
  occupiedSpaces: number;
  todayBookings: number;
  upcomingBookings: number;
  totalBookings: number;
};

type Notification = {
  type: 'danger' | 'warning' | 'info' | 'success';
  icon: React.ReactNode;
  title: string;
  message: string;
};

type PendingBooking = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time?: string;
  is_half_day?: boolean;
  half_day_period?: 'morning' | 'afternoon';
  booking_type: 'meeting_room' | 'flex_workspace';
  tenant_id?: string | null;
  external_customer_id?: string | null;
  space: {
    space_number: string;
  };
  tenants?: {
    company_name: string;
  };
  external_customers?: {
    company_name: string;
  };
};

type Invoice = {
  invoice_number: string;
  amount: number;
  status: string;
  due_date: string;
  tenant_id?: string | null;
  external_customer_id?: string | null;
  tenants?: {
    company_name: string;
  };
  external_customers?: {
    company_name: string;
  };
};

type Lease = {
  id: string;
  end_date: string;
  status: string;
  tenant_id: string;
  tenants?: {
    name: string;
  };
};

type DashboardProps = {
  onNavigateToDebtors?: (subTab: 'facturen' | 'outstanding') => void;
  onNavigateToInvoicing?: (month: string) => void;
};

export function Dashboard({ onNavigateToDebtors, onNavigateToInvoicing }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalTenants: 0,
    totalSpaces: 0,
    occupiedSpaces: 0,
    todayBookings: 0,
    upcomingBookings: 0,
    totalBookings: 0
  });
  const [financialNotifications, setFinancialNotifications] = useState<Notification[]>([]);
  const [bookingNotifications, setBookingNotifications] = useState<Notification[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState<Invoice[]>([]);
  const [draftInvoices, setDraftInvoices] = useState<Invoice[]>([]);
  const [expiredLeases, setExpiredLeases] = useState<Lease[]>([]);
  const [expiringLeases, setExpiringLeases] = useState<Lease[]>([]);
  const [overdueAmount, setOverdueAmount] = useState(0);
  const [draftAmount, setDraftAmount] = useState(0);
  const [outstandingAmount, setOutstandingAmount] = useState(0);
  const { totalItems: unbilledCount, totalAmount: unbilledAmount, groups: unbilledGroups } = useUnbilledItems();
  const [unbilledExpanded, setUnbilledExpanded] = useState(false);

  useEffect(() => {
    loadDashboardStats();

    const meetingChannel = supabase
      .channel('dashboard-meeting-bookings')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'meeting_room_bookings'
      }, () => {
        loadDashboardStats();
      })
      .subscribe();

    const flexChannel = supabase
      .channel('dashboard-flex-bookings')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'flex_day_bookings'
      }, () => {
        loadDashboardStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(meetingChannel);
      supabase.removeChannel(flexChannel);
    };
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleStatusChange = async (booking: PendingBooking, newStatus: 'confirmed' | 'cancelled') => {
    const tableName = booking.booking_type === 'meeting_room' ? 'meeting_room_bookings' : 'flex_day_bookings';

    const { error } = await supabase
      .from(tableName)
      .update({ status: newStatus })
      .eq('id', booking.id);

    if (error) {
      console.error('Error updating status:', error);
      showNotification('Fout bij het bijwerken van de status.', 'error');
      return;
    }

    if (newStatus === 'cancelled') {
      const customerName = booking.booking_type === 'meeting_room'
        ? (booking.tenant_id ? (booking.tenants?.company_name || 'Onbekende huurder') : (booking.external_customers?.company_name || 'Onbekende klant'))
        : (booking.external_customers?.company_name || 'Onbekende klant');

      const bookingDetails = booking.booking_type === 'meeting_room'
        ? `${booking.space.space_number} op ${new Date(booking.booking_date).toLocaleDateString('nl-NL')} ${booking.start_time.substring(0, 5)}-${booking.end_time?.substring(0, 5)}`
        : booking.start_time && booking.end_time
        ? `${booking.space.space_number} op ${new Date(booking.booking_date).toLocaleDateString('nl-NL')} ${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)}`
        : `${booking.space.space_number} op ${new Date(booking.booking_date).toLocaleDateString('nl-NL')} ${booking.is_half_day ? (booking.half_day_period === 'morning' ? 'Ochtend' : 'Middag') : 'Hele dag'}`;

      await createAdminNotification(
        'booking_cancelled',
        booking.booking_type,
        booking.id,
        customerName,
        bookingDetails,
        booking.booking_type === 'meeting_room' ? booking.tenant_id || undefined : undefined,
        booking.booking_type === 'meeting_room' ? booking.external_customer_id || undefined : booking.external_customer_id || undefined
      );
    }

    setPendingBookings(prev => prev.filter(b => b.id !== booking.id));

    const statusText = newStatus === 'confirmed' ? 'geaccepteerd' : 'geweigerd';
    showNotification(`Boeking is ${statusText}.`, 'success');
  };

  const loadDashboardStats = async () => {
    setLoading(true);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const fourteenDaysFromNow = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const fourteenDaysStr = fourteenDaysFromNow.toISOString().split('T')[0];
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

    const [
      { data: tenants },
      { data: spaces },
      { data: activeLeases },
      { data: leaseSpaces },
      { data: invoices },
      { count: todayBookingCount },
      { count: upcomingBookingCount },
      { data: pendingMeetingRooms },
      { data: pendingFlexBookings },
    ] = await Promise.all([
      supabase.from('tenants').select('id'),
      supabase.from('office_spaces').select('is_available, space_type').in('space_type', ['kantoor', 'bedrijfsruimte']),
      supabase.from('leases').select('id, end_date, status, tenant_id, tenants(name)').eq('status', 'active'),
      supabase.from('lease_spaces').select('space_id, lease_id, leases!inner(status)').eq('leases.status', 'active'),
      supabase.from('invoices').select(`
        invoice_number, amount, status, due_date, tenant_id, external_customer_id,
        tenants(company_name), external_customers(company_name)
      `).in('status', ['draft', 'sent', 'overdue']),
      supabase.from('meeting_room_bookings').select('*', { count: 'exact', head: true }).eq('booking_date', todayStr).neq('status', 'cancelled'),
      supabase.from('meeting_room_bookings').select('*', { count: 'exact', head: true }).gte('booking_date', todayStr).lte('booking_date', sevenDaysStr).neq('status', 'cancelled'),
      supabase
        .from('meeting_room_bookings')
        .select(`
          id, booking_date, start_time, end_time, tenant_id, external_customer_id,
          space:office_spaces(space_number), tenants(company_name), external_customers(company_name)
        `)
        .eq('status', 'pending')
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(10),
      supabase
        .from('flex_day_bookings')
        .select(`
          id, booking_date, start_time, end_time, is_half_day, half_day_period, external_customer_id,
          space:office_spaces(space_number), external_customers(company_name)
        `)
        .eq('status', 'pending')
        .order('booking_date', { ascending: true })
        .limit(10),
    ]);

    const allPendingBookings: PendingBooking[] = [
      ...(pendingMeetingRooms || []).map(b => ({ ...b, booking_type: 'meeting_room' as const })),
      ...(pendingFlexBookings || []).map(b => ({ ...b, booking_type: 'flex_workspace' as const }))
    ].sort((a, b) => new Date(a.booking_date).getTime() - new Date(b.booking_date).getTime());

    const occupiedSpaces = new Set((leaseSpaces || []).map(ls => ls.space_id)).size;
    const totalRentableSpaces = spaces?.length || 0;

    const expiringLeasesData = activeLeases?.filter(
      lease => lease.end_date >= todayStr && lease.end_date <= fourteenDaysStr
    ) || [];

    const expiredLeasesData = activeLeases?.filter(
      lease => lease.end_date < todayStr
    ) || [];

    const draftInvoicesData = invoices?.filter(inv => inv.status === 'draft') || [];
    const outstandingInvoicesData = invoices?.filter(inv => inv.status === 'sent' && inv.due_date >= todayStr) || [];
    const overdueInvoicesData = invoices?.filter(inv => inv.status !== 'paid' && inv.status !== 'credited' && inv.due_date < todayStr) || [];
    const upcomingDueInvoices = invoices?.filter(
      inv => inv.status !== 'paid' && inv.status !== 'credited' && inv.due_date >= todayStr && inv.due_date <= sevenDaysStr
    ) || [];

    const overdueAmt = overdueInvoicesData.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const draftAmt = draftInvoicesData.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const outstandingAmt = outstandingInvoicesData.reduce((sum, inv) => sum + Number(inv.amount), 0);

    setPendingBookings(allPendingBookings);
    setExpiringLeases(expiringLeasesData);
    setExpiredLeases(expiredLeasesData);
    setDraftInvoices(draftInvoicesData);
    setOutstandingInvoices(outstandingInvoicesData);
    setOverdueInvoices(overdueInvoicesData);
    setOverdueAmount(overdueAmt);
    setDraftAmount(draftAmt);
    setOutstandingAmount(outstandingAmt);
    setStats({
      totalTenants: tenants?.length || 0,
      totalSpaces: totalRentableSpaces,
      occupiedSpaces,
      todayBookings: todayBookingCount || 0,
      upcomingBookings: upcomingBookingCount || 0,
      totalBookings: 0
    });

    const newFinancialNotifications: Notification[] = [];
    const newBookingNotifications: Notification[] = [];

    if (draftInvoicesData.length > 0) {
      newFinancialNotifications.push({
        type: 'info',
        icon: <FileText size={18} />,
        title: 'Concept Facturen',
        message: `${draftInvoicesData.length} factu${draftInvoicesData.length !== 1 ? 'ren' : 'ur'} in concept (€${draftAmt.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
      });
    }

    if (outstandingInvoicesData.length > 0) {
      const invoiceDetails = outstandingInvoicesData.slice(0, 3).map(inv => {
        const customerName = inv.tenant_id
          ? (inv.tenants?.company_name || 'Onbekende huurder')
          : (inv.external_customers?.company_name || 'Externe klant');
        return `${inv.invoice_number} (${customerName})`;
      }).join(', ');
      const moreCount = outstandingInvoicesData.length > 3 ? ` en ${outstandingInvoicesData.length - 3} meer` : '';

      newFinancialNotifications.push({
        type: 'info',
        icon: <FileText size={18} />,
        title: 'Openstaande Facturen',
        message: `${outstandingInvoicesData.length} factu${outstandingInvoicesData.length !== 1 ? 'ren' : 'ur'} openstaand: ${invoiceDetails}${moreCount} (€${outstandingAmt.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
      });
    }

    if (overdueInvoicesData.length > 0) {
      const invoiceDetails = overdueInvoicesData.map(inv => {
        const customerName = inv.tenant_id
          ? (inv.tenants?.company_name || 'Onbekende huurder')
          : (inv.external_customers?.company_name || 'Externe klant');
        return `${inv.invoice_number} (${customerName})`;
      }).join(', ');

      newFinancialNotifications.push({
        type: 'danger',
        icon: <DollarSign size={18} />,
        title: 'Achterstallige Facturen',
        message: `${overdueInvoicesData.length} factu${overdueInvoicesData.length !== 1 ? 'ren' : 'ur'} over de vervaldatum: ${invoiceDetails} (€${overdueAmt.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
      });
    }

    if (expiredLeasesData.length > 0) {
      newFinancialNotifications.push({
        type: 'danger',
        icon: <Calendar size={18} />,
        title: 'Verlopen Contracten',
        message: `${expiredLeasesData.length} contract${expiredLeasesData.length !== 1 ? 'en zijn' : ' is'} verlopen en moet${expiredLeasesData.length !== 1 ? 'en' : ''} worden verlengd of beëindigd`
      });
    }

    if (upcomingDueInvoices.length > 0) {
      const invoiceDetails = upcomingDueInvoices.slice(0, 3).map(inv => {
        const customerName = inv.tenant_id
          ? (inv.tenants?.company_name || 'Onbekende huurder')
          : (inv.external_customers?.company_name || 'Externe klant');
        return `${inv.invoice_number} (${customerName})`;
      }).join(', ');
      const moreCount = upcomingDueInvoices.length > 3 ? ` en ${upcomingDueInvoices.length - 3} meer` : '';

      newFinancialNotifications.push({
        type: 'warning',
        icon: <FileText size={18} />,
        title: 'Binnenkort Te Betalen',
        message: `${upcomingDueInvoices.length} factu${upcomingDueInvoices.length !== 1 ? 'ren' : 'ur'} binnen 7 dagen: ${invoiceDetails}${moreCount}`
      });
    }

    if (expiringLeasesData.length > 0) {
      newFinancialNotifications.push({
        type: 'warning',
        icon: <Clock size={18} />,
        title: 'Contracten Verlopen Binnenkort',
        message: `${expiringLeasesData.length} contract${expiringLeasesData.length !== 1 ? 'en verlopen' : ' verloopt'} binnen 14 dagen`
      });
    }

    if ((todayBookingCount || 0) > 0) {
      newBookingNotifications.push({
        type: 'info',
        icon: <CalendarClock size={18} />,
        title: 'Vergaderruimte Boekingen Vandaag',
        message: `${todayBookingCount} boeking${todayBookingCount !== 1 ? 'en' : ''} gepland voor vandaag`
      });
    }

    const availableSpaces = totalRentableSpaces - occupiedSpaces;
    if (availableSpaces > 0) {
      newBookingNotifications.push({
        type: 'info',
        icon: <Building size={18} />,
        title: 'Beschikbare Ruimtes',
        message: `${availableSpaces} ruimte${availableSpaces !== 1 ? 's' : ''} beschikbaar voor verhuur`
      });
    }

    setFinancialNotifications(newFinancialNotifications);
    setBookingNotifications(newBookingNotifications);
    setLoading(false);
  };

  const occupancyRate = stats.totalSpaces > 0
    ? ((stats.occupiedSpaces / stats.totalSpaces) * 100).toFixed(1)
    : 0;

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="h-full bg-dark-950 overflow-y-auto p-3 sm:p-4 md:p-6">
      {notification && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          notification.type === 'success' ? 'bg-green-600' :
          notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
        } text-white`}>
          {notification.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-dark-700 rounded-lg">
              <Users className="text-gold-500" size={20} />
            </div>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-300 mb-1">Totaal Huurders</p>
            <div className="h-10 sm:h-12 flex items-center">
              <p className="text-2xl sm:text-3xl font-bold text-gray-100">{stats.totalTenants}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5 invisible">.</p>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-dark-700 rounded-lg">
              <Building className="text-green-400" size={20} />
            </div>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-300 mb-1">Totaal Ruimtes</p>
            <div className="h-10 sm:h-12 flex items-center">
              <p className="text-2xl sm:text-3xl font-bold text-gray-100">{stats.totalSpaces}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5">
              {stats.occupiedSpaces} bezet, {stats.totalSpaces - stats.occupiedSpaces} beschikbaar
            </p>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-dark-700 rounded-lg">
              <Building className="text-blue-400" size={20} />
            </div>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-300 mb-1">Bezettingsgraad</p>
            <div className="h-10 sm:h-12 flex items-center">
              <p className="text-2xl sm:text-3xl font-bold text-gray-100">{occupancyRate}%</p>
            </div>
            <div className="w-full bg-dark-800 rounded-full h-2 mt-1">
              <div
                className="bg-gradient-to-r from-gold-500 to-gold-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${occupancyRate}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-dark-700 rounded-lg">
              <CalendarClock className="text-purple-400" size={20} />
            </div>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-300 mb-1">Vergaderruimte Boekingen</p>
            <div className="h-10 sm:h-12 flex items-center">
              <p className="text-2xl sm:text-3xl font-bold text-gray-100">{stats.todayBookings}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5">
              {stats.upcomingBookings} komende week
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-dark-700 rounded-lg">
            <AlertCircle className="text-orange-400" size={20} />
          </div>
          <h3 className="text-lg font-semibold text-gray-100">Boekingen In Afwachting</h3>
          {pendingBookings.length > 0 && (
            <span className="ml-auto bg-orange-900 text-orange-400 px-3 py-1 rounded-full text-sm font-medium">
              {pendingBookings.length}
            </span>
          )}
        </div>

        {pendingBookings.length > 0 ? (
          <div className="space-y-3">
            {pendingBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-dark-800 rounded-lg border border-dark-700 p-4 hover:border-dark-600 transition-colors"
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <span className={`shrink-0 px-2.5 py-1 rounded text-xs font-semibold ${
                      booking.booking_type === 'meeting_room' ? 'bg-blue-900/60 text-blue-400' : 'bg-teal-900/60 text-teal-400'
                    }`}>
                      {booking.booking_type === 'meeting_room' ? 'Vergader' : 'Flex'}
                    </span>
                    <span className="text-gray-100 font-semibold truncate">
                      {booking.booking_type === 'meeting_room'
                        ? (booking.tenant_id ? booking.tenants?.company_name : booking.external_customers?.company_name)
                        : booking.external_customers?.company_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleStatusChange(booking, 'confirmed')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                      title="Accepteren"
                    >
                      <Check size={14} />
                      Accepteren
                    </button>
                    <button
                      onClick={() => handleStatusChange(booking, 'cancelled')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                      title="Weigeren"
                    >
                      <XCircle size={14} />
                      Weigeren
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-5 mt-3 text-sm text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-gold-500" />
                    {new Date(booking.booking_date).toLocaleDateString('nl-NL', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-gold-500" />
                    {booking.booking_type === 'meeting_room'
                      ? `${booking.start_time.substring(0, 5)} - ${booking.end_time?.substring(0, 5)}`
                      : booking.start_time && booking.end_time
                      ? `${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)}`
                      : booking.is_half_day
                      ? (booking.half_day_period === 'morning' ? 'Ochtend' : 'Middag')
                      : 'Hele dag'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-300 font-medium">{booking.space.space_number}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-dark-800 rounded-lg p-8 text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Geen openstaande aanvragen</p>
            <p className="text-gray-500 text-sm mt-1">Alle boekingen zijn verwerkt</p>
          </div>
        )}
      </div>

      <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-dark-700 rounded-lg">
            <DollarSign className="text-green-400" size={20} />
          </div>
          <h3 className="text-lg font-semibold text-gray-100">Financiële Meldingen</h3>
        </div>

        {(overdueInvoices.length > 0 || outstandingInvoices.length > 0 || draftInvoices.length > 0 || expiredLeases.length > 0 || expiringLeases.length > 0 || unbilledCount > 0) ? (
          <div className="space-y-2">
            {overdueInvoices.length > 0 && (
              <div
                onClick={() => onNavigateToDebtors?.('outstanding')}
                className="flex items-center justify-between px-3 py-2.5 bg-red-900/20 border border-red-800/60 rounded-lg cursor-pointer hover:bg-red-900/30 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="text-red-400" size={16} />
                  <span className="text-sm font-medium text-red-300">Achterstallig</span>
                  <span className="text-xs font-medium text-red-400 bg-red-900/60 px-1.5 py-0.5 rounded">{overdueInvoices.length}</span>
                </div>
                <span className="text-sm font-semibold text-red-400">
                  {'\u20AC'}{overdueAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {outstandingInvoices.length > 0 && (
              <div
                onClick={() => onNavigateToDebtors?.('outstanding')}
                className="flex items-center justify-between px-3 py-2.5 bg-blue-900/15 border border-blue-800/40 rounded-lg cursor-pointer hover:bg-blue-900/25 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="text-blue-400" size={16} />
                  <span className="text-sm font-medium text-blue-300">Openstaand</span>
                  <span className="text-xs font-medium text-blue-400 bg-blue-900/60 px-1.5 py-0.5 rounded">{outstandingInvoices.length}</span>
                </div>
                <span className="text-sm font-semibold text-blue-400">
                  {'\u20AC'}{outstandingAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {draftInvoices.length > 0 && (
              <div
                onClick={() => onNavigateToDebtors?.('facturen')}
                className="flex items-center justify-between px-3 py-2.5 bg-amber-900/15 border border-amber-800/40 rounded-lg cursor-pointer hover:bg-amber-900/25 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="text-amber-400" size={16} />
                  <span className="text-sm font-medium text-amber-300">Concept</span>
                  <span className="text-xs font-medium text-amber-400 bg-amber-900/60 px-1.5 py-0.5 rounded">{draftInvoices.length}</span>
                </div>
                <span className="text-sm font-semibold text-amber-400">
                  {'\u20AC'}{draftAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {unbilledCount > 0 && (
              <div className="bg-amber-900/15 border border-amber-800/40 rounded-lg overflow-hidden">
                <button
                  onClick={() => setUnbilledExpanded(!unbilledExpanded)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-amber-900/25 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="text-amber-400" size={16} />
                    <span className="text-sm font-medium text-amber-300">Ongefactureerd</span>
                    <span className="text-xs font-medium text-amber-400 bg-amber-900/60 px-1.5 py-0.5 rounded">{unbilledCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-amber-400">
                      {'\u20AC'}{unbilledAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {unbilledExpanded
                      ? <ChevronUp size={14} className="text-gray-500" />
                      : <ChevronDown size={14} className="text-gray-500" />
                    }
                  </div>
                </button>
                {unbilledExpanded && (
                  <div className="border-t border-amber-800/30">
                    {unbilledGroups.map(group => (
                      <div key={group.month} className="border-b border-dark-700/30 last:border-b-0">
                        <div className="px-3 py-2 flex items-center justify-between bg-dark-800/30">
                          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide capitalize">{group.monthLabel}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-amber-400">
                              {'\u20AC'}{group.totalAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {onNavigateToInvoicing && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onNavigateToInvoicing(group.month); }}
                                className="text-xs text-gold-500 hover:text-gold-400 flex items-center gap-0.5 transition-colors"
                              >
                                Factureren <ArrowRight size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="divide-y divide-dark-700/20">
                          {group.items.map((item, idx) => (
                            <div key={idx} className="px-4 py-1.5 flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                {item.type === 'huur' && <Home size={12} className="text-emerald-400" />}
                                {item.type === 'vergaderruimte' && <Calendar size={12} className="text-blue-400" />}
                                {item.type === 'flexplek' && <Zap size={12} className="text-teal-400" />}
                                <span className="text-xs text-gray-300">{item.customerName}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  item.type === 'huur' ? 'bg-emerald-900/40 text-emerald-400' :
                                  item.type === 'vergaderruimte' ? 'bg-blue-900/40 text-blue-400' :
                                  'bg-teal-900/40 text-teal-400'
                                }`}>
                                  {item.type === 'huur' ? 'Huur' : item.type === 'vergaderruimte' ? 'Vergader' : 'Flex'}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">
                                {'\u20AC'}{item.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {expiredLeases.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2.5 bg-red-900/15 border border-red-800/40 rounded-lg">
                <div className="flex items-center gap-2.5">
                  <Calendar className="text-red-400" size={16} />
                  <span className="text-sm font-medium text-red-300">Verlopen contracten</span>
                  <span className="text-xs font-medium text-red-400 bg-red-900/60 px-1.5 py-0.5 rounded">{expiredLeases.length}</span>
                </div>
              </div>
            )}

            {expiringLeases.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2.5 bg-amber-900/15 border border-amber-800/40 rounded-lg">
                <div className="flex items-center gap-2.5">
                  <Clock className="text-amber-400" size={16} />
                  <span className="text-sm font-medium text-amber-300">Verloopt binnenkort</span>
                  <span className="text-xs font-medium text-amber-400 bg-amber-900/60 px-1.5 py-0.5 rounded">{expiringLeases.length}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-dark-800 rounded-lg p-6 text-center">
            <CheckCircle size={36} className="text-green-500 mx-auto mb-2" />
            <p className="text-gray-400 font-medium text-sm">Geen meldingen</p>
          </div>
        )}
      </div>
      </div>

    </div>
  );
}
