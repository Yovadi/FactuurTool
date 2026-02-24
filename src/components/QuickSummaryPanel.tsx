import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Euro, FileText, AlertTriangle, CheckCircle, Clock, TrendingUp, Loader2 } from 'lucide-react';

type SummaryStats = {
  draftCount: number;
  draftAmount: number;
  openCount: number;
  openAmount: number;
  overdueCount: number;
  overdueAmount: number;
  paidThisMonth: number;
  paidThisMonthAmount: number;
  creditNotesOpen: number;
  creditNotesAmount: number;
  purchaseUnpaid: number;
  purchaseUnpaidAmount: number;
};

const formatCurrency = (amount: number) =>
  '\u20AC' + amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function QuickSummaryPanel() {
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const [invoicesResult, creditNotesResult, purchaseResult] = await Promise.all([
      supabase.from('invoices').select('status, amount, paid_at'),
      supabase.from('credit_notes').select('status, total_amount'),
      supabase.from('purchase_invoices').select('status, total_amount'),
    ]);

    const invoices = invoicesResult.data || [];
    const creditNotes = creditNotesResult.data || [];
    const purchases = purchaseResult.data || [];

    const draft = invoices.filter(i => i.status === 'draft');
    const open = invoices.filter(i => i.status === 'sent');
    const overdue = invoices.filter(i => i.status === 'overdue');
    const paidThisMonth = invoices.filter(i =>
      i.status === 'paid' && i.paid_at && i.paid_at >= monthStart
    );

    const openCredits = creditNotes.filter(c => c.status === 'issued');
    const unpaidPurchases = purchases.filter(p => p.status === 'pending' || p.status === 'approved');

    setStats({
      draftCount: draft.length,
      draftAmount: draft.reduce((s, i) => s + (i.amount || 0), 0),
      openCount: open.length,
      openAmount: open.reduce((s, i) => s + (i.amount || 0), 0),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + (i.amount || 0), 0),
      paidThisMonth: paidThisMonth.length,
      paidThisMonthAmount: paidThisMonth.reduce((s, i) => s + (i.amount || 0), 0),
      creditNotesOpen: openCredits.length,
      creditNotesAmount: openCredits.reduce((s, c) => s + (c.total_amount || 0), 0),
      purchaseUnpaid: unpaidPurchases.length,
      purchaseUnpaidAmount: unpaidPurchases.reduce((s, p) => s + (p.total_amount || 0), 0),
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-gold-500" size={24} />
      </div>
    );
  }

  if (!stats) return null;

  const cards: {
    label: string;
    count: number;
    amount: number;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
  }[] = [
    {
      label: 'Concept facturen',
      count: stats.draftCount,
      amount: stats.draftAmount,
      icon: <FileText size={16} />,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      label: 'Openstaand',
      count: stats.openCount,
      amount: stats.openAmount,
      icon: <Clock size={16} />,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      label: 'Verlopen',
      count: stats.overdueCount,
      amount: stats.overdueAmount,
      icon: <AlertTriangle size={16} />,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
    },
    {
      label: 'Betaald deze maand',
      count: stats.paidThisMonth,
      amount: stats.paidThisMonthAmount,
      icon: <CheckCircle size={16} />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
    },
    {
      label: 'Open creditnota\'s',
      count: stats.creditNotesOpen,
      amount: stats.creditNotesAmount,
      icon: <Euro size={16} />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
    {
      label: 'Onbetaalde inkoop',
      count: stats.purchaseUnpaid,
      amount: stats.purchaseUnpaidAmount,
      icon: <TrendingUp size={16} />,
      color: 'text-teal-400',
      bgColor: 'bg-teal-500/10',
      borderColor: 'border-teal-500/20',
    },
  ];

  const totalOutstanding = stats.openAmount + stats.overdueAmount;

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="px-5 py-4 border-b border-dark-700 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-100">Snelle Samenvatting</h3>
        <p className="text-xs text-gray-500 mt-0.5">Financieel overzicht op dit moment</p>
      </div>

      <div className="p-4 space-y-3 flex-1">
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
          <p className="text-xs text-gray-500 mb-1">Totaal openstaand</p>
          <p className="text-2xl font-bold text-gold-400">{formatCurrency(totalOutstanding)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.openCount + stats.overdueCount} facturen
          </p>
        </div>

        <div className="space-y-2">
          {cards.map((card) => (
            <div
              key={card.label}
              className={`${card.bgColor} border ${card.borderColor} rounded-lg px-4 py-3 flex items-center gap-3`}
            >
              <div className={`${card.color} flex-shrink-0`}>{card.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">{card.label}</p>
                <p className={`text-sm font-semibold ${card.color}`}>{formatCurrency(card.amount)}</p>
              </div>
              <div className="flex-shrink-0">
                <span className={`text-xs font-medium ${card.color} bg-dark-900/50 px-2 py-0.5 rounded-full`}>
                  {card.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
