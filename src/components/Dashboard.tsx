import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building, Users, AlertCircle, Calendar, Clock, CalendarClock, FileText, DollarSign, CheckCircle, Check, XCircle } from 'lucide-react';
import { SkeletonDashboard } from './SkeletonLoader';
import { createAdminNotification } from '../utils/notificationHelper';

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
  amount: number;
  status: string;
  due_date: string;
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

export function Dashboard() {
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

  useEffect(() => {
    loadDashboardStats();
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

    const { data: tenants } = await supabase
      .from('tenants')
      .select('id');

    const { data: spaces } = await supabase
      .from('office_spaces')
      .select('is_available, space_type')
      .in('space_type', ['kantoor', 'bedrijfsruimte']);

    const { data: leases } = await supabase
      .from('leases')
      .select('id, end_date, status, tenant_id, tenants(name)');

    const { data: leaseSpaces } = await supabase
      .from('lease_spaces')
      .select('space_id, lease_id, leases!inner(status)');

    const { data: invoices } = await supabase
      .from('invoices')
      .select('amount, status, due_date');

    const { data: bookings } = await supabase
      .from('meeting_room_bookings')
      .select('id, booking_date, start_time, end_time, status');

    const { data: pendingMeetingRooms } = await supabase
      .from('meeting_room_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        tenant_id,
        external_customer_id,
        space:office_spaces(space_number),
        tenants(company_name),
        external_customers(company_name)
      `)
      .eq('status', 'pending')
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(10);

    const { data: pendingFlexBookings } = await supabase
      .from('flex_day_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        is_half_day,
        half_day_period,
        external_customer_id,
        space:office_spaces(space_number),
        external_customers(company_name)
      `)
      .eq('status', 'pending')
      .order('booking_date', { ascending: true })
      .limit(10);

    const allPendingBookings: PendingBooking[] = [
      ...(pendingMeetingRooms || []).map(b => ({ ...b, booking_type: 'meeting_room' as const })),
      ...(pendingFlexBookings || []).map(b => ({ ...b, booking_type: 'flex_workspace' as const }))
    ].sort((a, b) => new Date(a.booking_date).getTime() - new Date(b.booking_date).getTime());

    setPendingBookings(allPendingBookings);

    const activeLeaseSpaceIds = new Set(
      leaseSpaces
        ?.filter(ls => ls.leases?.status === 'active')
        .map(ls => ls.space_id) || []
    );

    const occupiedSpaces = activeLeaseSpaceIds.size;
    const totalRentableSpaces = spaces?.length || 0;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const fourteenDaysFromNow = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const fourteenDaysStr = fourteenDaysFromNow.toISOString().split('T')[0];
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

    const todayBookings = bookings?.filter(b => b.booking_date === todayStr && b.status !== 'cancelled').length || 0;
    const upcomingBookings = bookings?.filter(
      b => b.booking_date >= todayStr && b.booking_date <= sevenDaysStr && b.status !== 'cancelled'
    ).length || 0;

    const expiringLeasesData = leases?.filter(
      lease => lease.status === 'active' && lease.end_date >= todayStr && lease.end_date <= fourteenDaysStr
    ) || [];
    setExpiringLeases(expiringLeasesData);

    const expiredLeasesData = leases?.filter(
      lease => lease.status === 'active' && lease.end_date < todayStr
    ) || [];
    setExpiredLeases(expiredLeasesData);

    const draftInvoicesData = invoices?.filter(
      inv => inv.status === 'concept'
    ) || [];
    setDraftInvoices(draftInvoicesData);

    const outstandingInvoicesData = invoices?.filter(
      inv => inv.status === 'verzonden'
    ) || [];
    setOutstandingInvoices(outstandingInvoicesData);

    const overdueInvoicesData = invoices?.filter(
      inv => inv.status !== 'paid' && inv.due_date < todayStr
    ) || [];
    setOverdueInvoices(overdueInvoicesData);

    const upcomingDueInvoices = invoices?.filter(
      inv => inv.status !== 'paid' && inv.due_date >= todayStr && inv.due_date <= sevenDaysStr
    ) || [];

    const overdueAmt = overdueInvoicesData.reduce((sum, inv) => sum + Number(inv.amount), 0);
    setOverdueAmount(overdueAmt);

    const draftAmt = draftInvoicesData.reduce((sum, inv) => sum + Number(inv.amount), 0);
    setDraftAmount(draftAmt);

    const outstandingAmt = outstandingInvoicesData.reduce((sum, inv) => sum + Number(inv.amount), 0);
    setOutstandingAmount(outstandingAmt);

    setStats({
      totalTenants: tenants?.length || 0,
      totalSpaces: totalRentableSpaces,
      occupiedSpaces,
      todayBookings,
      upcomingBookings,
      totalBookings: bookings?.length || 0
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
      newFinancialNotifications.push({
        type: 'info',
        icon: <FileText size={18} />,
        title: 'Openstaande Facturen',
        message: `${outstandingInvoicesData.length} factu${outstandingInvoicesData.length !== 1 ? 'ren' : 'ur'} openstaand (€${outstandingAmt.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
      });
    }

    if (overdueInvoicesData.length > 0) {
      newFinancialNotifications.push({
        type: 'danger',
        icon: <DollarSign size={18} />,
        title: 'Achterstallige Facturen',
        message: `${overdueInvoicesData.length} factu${overdueInvoicesData.length !== 1 ? 'ren' : 'ur'} over de vervaldatum (€${overdueAmt.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
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
      newFinancialNotifications.push({
        type: 'warning',
        icon: <FileText size={18} />,
        title: 'Binnenkort Te Betalen',
        message: `${upcomingDueInvoices.length} factu${upcomingDueInvoices.length !== 1 ? 'ren' : 'ur'} moet${upcomingDueInvoices.length !== 1 ? 'en' : ''} binnen 7 dagen betaald worden`
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

    if (todayBookings > 0) {
      newBookingNotifications.push({
        type: 'info',
        icon: <CalendarClock size={18} />,
        title: 'Vergaderruimte Boekingen Vandaag',
        message: `${todayBookings} boeking${todayBookings !== 1 ? 'en' : ''} gepland voor vandaag`
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

      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-2">Overzicht</h1>
        <p className="text-sm sm:text-base text-gray-300">Overzicht van je kantoorgebouw beheer</p>
      </div>

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

      <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-dark-700 rounded-lg">
            <DollarSign className="text-green-400" size={20} />
          </div>
          <h3 className="text-lg font-semibold text-gray-100">Financiële Meldingen</h3>
        </div>

        {(overdueInvoices.length > 0 || outstandingInvoices.length > 0 || draftInvoices.length > 0 || expiredLeases.length > 0 || expiringLeases.length > 0) ? (
          <div className="grid grid-cols-1 gap-3">
            {overdueInvoices.length > 0 && (
              <div className="bg-red-900/20 border-2 border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-400 mt-0.5" size={20} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-red-400">Achterstallige Facturen</h4>
                      <span className="text-xs font-medium text-red-400 bg-red-900 px-2 py-1 rounded">
                        {overdueInvoices.length} {overdueInvoices.length === 1 ? 'factuur' : 'facturen'}
                      </span>
                    </div>
                    <p className="text-xs text-red-300">
                      Facturen over de vervaldatum die direct aandacht nodig hebben
                    </p>
                    <p className="text-lg font-bold text-red-400 mt-2">
                      €{overdueAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {outstandingInvoices.length > 0 && (
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="text-blue-400 mt-0.5" size={20} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-blue-400">Openstaande Facturen</h4>
                      <span className="text-xs font-medium text-blue-400 bg-blue-900 px-2 py-1 rounded">
                        {outstandingInvoices.length} {outstandingInvoices.length === 1 ? 'factuur' : 'facturen'}
                      </span>
                    </div>
                    <p className="text-xs text-blue-300">
                      Verzonden facturen die nog betaald moeten worden
                    </p>
                    <p className="text-lg font-bold text-blue-400 mt-2">
                      €{outstandingAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {draftInvoices.length > 0 && (
              <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="text-amber-400 mt-0.5" size={20} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-amber-400">Concept Facturen</h4>
                      <span className="text-xs font-medium text-amber-400 bg-amber-900 px-2 py-1 rounded">
                        {draftInvoices.length} {draftInvoices.length === 1 ? 'factuur' : 'facturen'}
                      </span>
                    </div>
                    <p className="text-xs text-amber-300">
                      Conceptfacturen die nog verzonden moeten worden
                    </p>
                    <p className="text-lg font-bold text-amber-400 mt-2">
                      €{draftAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(expiredLeases.length > 0 || expiringLeases.length > 0) && (
              <div className="border-t border-dark-700 my-2"></div>
            )}

            {expiredLeases.length > 0 && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Calendar className="text-red-400 mt-0.5" size={20} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-red-400">Verlopen Contracten</h4>
                      <span className="text-xs font-medium text-red-400 bg-red-900 px-2 py-1 rounded">
                        {expiredLeases.length}
                      </span>
                    </div>
                    <p className="text-xs text-red-300">
                      {expiredLeases.length} contract{expiredLeases.length !== 1 ? 'en zijn' : ' is'} verlopen en moet{expiredLeases.length !== 1 ? 'en' : ''} worden verlengd of beëindigd
                    </p>
                  </div>
                </div>
              </div>
            )}

            {expiringLeases.length > 0 && (
              <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Clock className="text-amber-400 mt-0.5" size={20} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-amber-400">Contracten Verlopen Binnenkort</h4>
                      <span className="text-xs font-medium text-amber-400 bg-amber-900 px-2 py-1 rounded">
                        {expiringLeases.length}
                      </span>
                    </div>
                    <p className="text-xs text-amber-300">
                      {expiringLeases.length} contract{expiringLeases.length !== 1 ? 'en verlopen' : ' verloopt'} binnen 14 dagen
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-dark-800 rounded-lg p-8 text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Geen financiële meldingen</p>
            <p className="text-gray-500 text-sm mt-1">Alles is up-to-date</p>
          </div>
        )}
      </div>

      <div className="mt-6 bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
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
          <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                    <th className="text-left px-4 py-3 font-semibold">Type</th>
                    <th className="text-left px-4 py-3 font-semibold">Klant</th>
                    <th className="text-left px-4 py-3 font-semibold">Datum</th>
                    <th className="text-left px-4 py-3 font-semibold">Tijd</th>
                    <th className="text-left px-4 py-3 font-semibold">Ruimte</th>
                    <th className="text-center px-4 py-3 font-semibold">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="border-b border-dark-700 hover:bg-dark-700 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          booking.booking_type === 'meeting_room' ? 'bg-blue-900 text-blue-400' : 'bg-purple-900 text-purple-400'
                        }`}>
                          {booking.booking_type === 'meeting_room' ? 'Vergader' : 'Flex'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-100 font-medium">
                          {booking.booking_type === 'meeting_room'
                            ? (booking.tenant_id ? booking.tenants?.company_name : booking.external_customers?.company_name)
                            : booking.external_customers?.company_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Calendar size={16} className="text-gold-500" />
                          {new Date(booking.booking_date).toLocaleDateString('nl-NL', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Clock size={16} className="text-gold-500" />
                          {booking.booking_type === 'meeting_room'
                            ? `${booking.start_time.substring(0, 5)} - ${booking.end_time?.substring(0, 5)}`
                            : booking.start_time && booking.end_time
                            ? `${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)}`
                            : booking.is_half_day
                            ? (booking.half_day_period === 'morning' ? 'Ochtend' : 'Middag')
                            : 'Hele dag'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-100 font-medium">
                          {booking.space.space_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleStatusChange(booking, 'confirmed')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                            title="Accepteren"
                          >
                            <Check size={14} />
                            Accepteren
                          </button>
                          <button
                            onClick={() => handleStatusChange(booking, 'cancelled')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
                            title="Weigeren"
                          >
                            <XCircle size={14} />
                            Weigeren
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-dark-800 rounded-lg p-8 text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Geen openstaande aanvragen</p>
            <p className="text-gray-500 text-sm mt-1">Alle boekingen zijn verwerkt</p>
          </div>
        )}
      </div>
    </div>
  );
}
