import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Loader2, RefreshCw, CheckCircle2, Clock, FileText,
  Receipt, Link2, Users, Calendar, ChevronDown, ChevronUp, Play, DoorOpen, Armchair,
  AlertTriangle, TrendingUp, CalendarCheck
} from 'lucide-react';

interface ScheduledJob {
  id: string;
  job_type: string;
  last_run_at: string | null;
  next_run_at: string | null;
  is_enabled: boolean;
  created_at: string;
}

const JOB_META: Record<string, {
  label: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  interval: string;
  category: 'facturatie' | 'eboekhouden' | 'beheer';
}> = {
  generate_monthly_invoices: {
    label: 'Maandelijkse huurfacturen aanmaken',
    description: 'Genereert automatisch facturen voor alle actieve huurovereenkomsten aan het begin van elke maand.',
    icon: <FileText size={18} />,
    accentColor: 'teal',
    interval: 'Maandelijks (1e van de maand)',
    category: 'facturatie',
  },
  generate_meeting_room_invoices: {
    label: 'Vergaderruimte facturen aanmaken',
    description: 'Genereert automatisch facturen voor alle bevestigde en voltooide vergaderruimte boekingen van de vorige maand die nog niet zijn gefactureerd. Boekingen worden per klant gegroepeerd op één factuur.',
    icon: <DoorOpen size={18} />,
    accentColor: 'teal',
    interval: 'Maandelijks (1e van de maand)',
    category: 'facturatie',
  },
  generate_flex_invoices: {
    label: 'Flexplek facturen aanmaken',
    description: 'Genereert automatisch facturen voor alle bevestigde en voltooide flexwerkplek boekingen van de vorige maand die nog niet zijn gefactureerd. Boekingen worden per klant gegroepeerd op één factuur.',
    icon: <Armchair size={18} />,
    accentColor: 'teal',
    interval: 'Maandelijks (1e van de maand)',
    category: 'facturatie',
  },
  check_expiring_leases: {
    label: 'Verlopen contracten signaleren',
    description: 'Controleert dagelijks of huurcontracten binnen 30 of 60 dagen aflopen en maakt een melding aan in het notificatiecentrum. Per contract wordt maximaal één keer per week een melding gestuurd.',
    icon: <AlertTriangle size={18} />,
    accentColor: 'amber',
    interval: 'Dagelijks (elke 24 uur)',
    category: 'beheer',
  },
  apply_rent_indexation: {
    label: 'Jaarlijkse huurprijsverhoging toepassen',
    description: 'Past jaarlijks op 1 januari automatisch het ingestelde verhogingspercentage toe op alle actieve huurcontracten (alleen vaste huur). Elk contract wordt maximaal één keer per jaar verhoogd.',
    icon: <TrendingUp size={18} />,
    accentColor: 'amber',
    interval: 'Jaarlijks (1 januari)',
    category: 'beheer',
  },
  complete_past_bookings: {
    label: 'Verlopen boekingen afronden',
    description: 'Zet vergaderruimte- en flexplekboekingen die in het verleden liggen maar nog op "bevestigd" staan automatisch op "voltooid". Zo blijft het boekingenoverzicht netjes en kloppen de statistieken.',
    icon: <CalendarCheck size={18} />,
    accentColor: 'amber',
    interval: 'Dagelijks (elke 24 uur)',
    category: 'beheer',
  },
  eboekhouden_payment_status_check: {
    label: 'Betaalstatus facturen controleren',
    description: 'Controleert dagelijks de betaalstatus van verkoop- en inkoopfacturen in e-Boekhouden en werkt de lokale status bij.',
    icon: <Receipt size={18} />,
    accentColor: 'blue',
    interval: 'Dagelijks (elke 24 uur)',
    category: 'eboekhouden',
  },
  eboekhouden_sync_verification: {
    label: 'Synchronisatiestatus verifiëren',
    description: 'Verifieert dagelijks of gesynchroniseerde facturen en creditnota\'s nog bestaan in e-Boekhouden.',
    icon: <Link2 size={18} />,
    accentColor: 'blue',
    interval: 'Dagelijks (elke 24 uur)',
    category: 'eboekhouden',
  },
  eboekhouden_relation_verification: {
    label: 'Relaties verifiëren',
    description: 'Verifieert dagelijks of gesynchroniseerde huurders en externe klanten nog als relatie bestaan in e-Boekhouden.',
    icon: <Users size={18} />,
    accentColor: 'blue',
    interval: 'Dagelijks (elke 24 uur)',
    category: 'eboekhouden',
  },
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; ring: string; toggle: string; badge: string; badgeText: string }> = {
  teal: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    ring: 'focus:ring-teal-500',
    toggle: 'bg-teal-600',
    badge: 'bg-teal-500/10 border-teal-500/20',
    badgeText: 'text-teal-400',
  },
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    ring: 'focus:ring-blue-500',
    toggle: 'bg-blue-600',
    badge: 'bg-blue-500/10 border-blue-500/20',
    badgeText: 'text-blue-400',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    ring: 'focus:ring-amber-500',
    toggle: 'bg-amber-600',
    badge: 'bg-amber-500/10 border-amber-500/20',
    badgeText: 'text-amber-400',
  },
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getNextRunStatus(next_run_at: string | null, is_enabled: boolean): {
  label: string;
  color: 'green' | 'amber' | 'gray';
} {
  if (!is_enabled) return { label: 'Uitgeschakeld', color: 'gray' };
  if (!next_run_at) return { label: 'Niet gepland', color: 'amber' };
  const diff = new Date(next_run_at).getTime() - Date.now();
  if (diff <= 0) return { label: 'Klaar om te draaien', color: 'green' };
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return { label: `Over ${hours}u ${mins}m`, color: 'amber' };
  return { label: `Over ${mins}m`, color: 'amber' };
}

function JobCard({ job, onToggle, onRunNow, extraConfig }: {
  job: ScheduledJob;
  onToggle: (id: string, enabled: boolean) => void;
  onRunNow: (id: string, jobType: string) => void;
  extraConfig?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);

  const meta = JOB_META[job.job_type];
  if (!meta) return null;

  const colors = COLOR_CLASSES[meta.accentColor];
  const status = getNextRunStatus(job.next_run_at, job.is_enabled);

  const statusColors: Record<string, string> = {
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    gray: 'bg-dark-700 text-gray-500 border-dark-600',
  };

  const statusDots: Record<string, string> = {
    green: 'bg-green-400',
    amber: 'bg-amber-400',
    gray: 'bg-gray-600',
  };

  const handleToggle = async () => {
    setToggling(true);
    await onToggle(job.id, !job.is_enabled);
    setToggling(false);
  };

  const handleRunNow = async () => {
    setRunning(true);
    await onRunNow(job.id, job.job_type);
    setRunning(false);
  };

  return (
    <div className={`bg-dark-900 rounded-xl border transition-colors ${
      job.is_enabled ? 'border-dark-700' : 'border-dark-800 opacity-70'
    } overflow-hidden`}>
      <div className="px-5 py-4">
        <div className="flex items-start gap-4">
          <div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
            <span className={colors.text}>{meta.icon}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`font-semibold text-sm ${job.is_enabled ? 'text-gray-100' : 'text-gray-400'}`}>
                  {meta.label}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium border ${statusColors[status.color]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDots[status.color]}`} />
                    {status.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${colors.badge} ${colors.badgeText}`}>
                    <Clock size={10} />
                    {meta.interval}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {toggling ? (
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                ) : (
                  <button
                    onClick={handleToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      job.is_enabled ? colors.toggle : 'bg-dark-600'
                    }`}
                    title={job.is_enabled ? 'Uitschakelen' : 'Inschakelen'}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      job.is_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                )}
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-dark-800"
                >
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-dark-800 px-5 py-4 space-y-4">
          <p className="text-sm text-gray-400 leading-relaxed">{meta.description}</p>

          {extraConfig && (
            <div className="bg-dark-800 rounded-lg p-4">
              {extraConfig}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-dark-800 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Laatste uitvoering</p>
              <p className="text-sm text-gray-200 font-medium">{formatDateTime(job.last_run_at)}</p>
            </div>
            <div className="bg-dark-800 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Volgende uitvoering</p>
              <p className="text-sm text-gray-200 font-medium">{formatDateTime(job.next_run_at)}</p>
            </div>
          </div>

          {job.is_enabled && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleRunNow}
                disabled={running}
                className="flex items-center gap-2 bg-dark-800 hover:bg-dark-700 border border-dark-600 text-gray-200 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {running ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                {running ? 'Bezig...' : 'Nu uitvoeren'}
              </button>
              {running && (
                <span className="text-xs text-gray-500">Automatisering wordt uitgevoerd...</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Automatiseringen() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [eboekhoudenEnabled, setEboekhoudenEnabled] = useState(false);
  const [indexationPercentage, setIndexationPercentage] = useState<number>(0);
  const [savingPercentage, setSavingPercentage] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    const [jobsResult, settingsResult] = await Promise.all([
      supabase.from('scheduled_jobs').select('*').order('created_at', { ascending: true }),
      supabase.from('company_settings').select('eboekhouden_enabled, rent_indexation_percentage').maybeSingle(),
    ]);

    if (jobsResult.data) setJobs(jobsResult.data);
    if (settingsResult.data) {
      setEboekhoudenEnabled(settingsResult.data.eboekhouden_enabled ?? false);
      setIndexationPercentage(settingsResult.data.rent_indexation_percentage ?? 0);
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadJobs();
    setLastRefresh(new Date());
    setRefreshing(false);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await supabase
      .from('scheduled_jobs')
      .update({ is_enabled: enabled })
      .eq('id', id);

    setJobs(prev => prev.map(j => j.id === id ? { ...j, is_enabled: enabled } : j));
  };

  const handleRunNow = async (id: string, jobType: string) => {
    await supabase
      .from('scheduled_jobs')
      .update({ next_run_at: new Date().toISOString() })
      .eq('id', id);

    setJobs(prev => prev.map(j =>
      j.id === id ? { ...j, next_run_at: new Date().toISOString() } : j
    ));

    const { checkAndRunScheduledJobs } = await import('../utils/scheduledJobs');
    await checkAndRunScheduledJobs();

    await loadJobs();
  };

  const handleSaveIndexationPercentage = async (value: number) => {
    setSavingPercentage(true);
    const { data: existing } = await supabase.from('company_settings').select('id').maybeSingle();
    if (existing?.id) {
      await supabase.from('company_settings').update({ rent_indexation_percentage: value }).eq('id', existing.id);
    }
    setIndexationPercentage(value);
    setSavingPercentage(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-gold-500" size={28} />
      </div>
    );
  }

  const facturatieJobs = jobs.filter(j => JOB_META[j.job_type]?.category === 'facturatie');
  const beheerJobs = jobs.filter(j => JOB_META[j.job_type]?.category === 'beheer');
  const eboekhoudenJobs = eboekhoudenEnabled
    ? jobs.filter(j => JOB_META[j.job_type]?.category === 'eboekhouden')
    : [];
  const visibleJobs = [...facturatieJobs, ...beheerJobs, ...eboekhoudenJobs];
  const enabledCount = visibleJobs.filter(j => j.is_enabled).length;

  const indexationConfig = (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-300">Verhogingspercentage (%)</p>
      <p className="text-xs text-gray-500">Dit percentage wordt jaarlijks op 1 januari toegepast op de huurprijs van alle actieve vaste huurcontracten.</p>
      <div className="flex items-center gap-3 mt-2">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={indexationPercentage}
          onChange={e => setIndexationPercentage(parseFloat(e.target.value) || 0)}
          className="w-24 bg-dark-700 border border-dark-600 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <span className="text-sm text-gray-400">%</span>
        <button
          onClick={() => handleSaveIndexationPercentage(indexationPercentage)}
          disabled={savingPercentage}
          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {savingPercentage ? <Loader2 size={12} className="animate-spin" /> : null}
          Opslaan
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">
            {enabledCount} van {visibleJobs.length} automatiseringen actief
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Vernieuwen
        </button>
      </div>

      <div className="rounded-xl bg-dark-800/50 border border-dark-700 px-5 py-4 flex items-start gap-3">
        <Clock size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-gray-400 leading-relaxed">
          Automatiseringen worden uitgevoerd zolang de app geopend is. Ze worden gecontroleerd bij het openen van de app en daarna elk uur opnieuw. Elke taak draait op zijn eigen schema en wordt overgeslagen als de app gesloten is tot het volgende controlemoment.
        </p>
      </div>

      {facturatieJobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-gray-500" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Facturatie</h3>
          </div>
          {facturatieJobs.map(job => (
            <JobCard key={job.id} job={job} onToggle={handleToggle} onRunNow={handleRunNow} />
          ))}
        </div>
      )}

      {beheerJobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-gray-500" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contractbeheer</h3>
          </div>
          {beheerJobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onToggle={handleToggle}
              onRunNow={handleRunNow}
              extraConfig={job.job_type === 'apply_rent_indexation' ? indexationConfig : undefined}
            />
          ))}
        </div>
      )}

      {eboekhoudenJobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-gray-500" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">e-Boekhouden synchronisatie</h3>
          </div>
          {eboekhoudenJobs.map(job => (
            <JobCard key={job.id} job={job} onToggle={handleToggle} onRunNow={handleRunNow} />
          ))}
        </div>
      )}

      {!eboekhoudenEnabled && (
        <div className="rounded-xl bg-dark-900 border border-dark-700 px-5 py-4 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-gray-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-500">e-Boekhouden synchronisatie</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Activeer de e-Boekhouden integratie via het tabblad Integraties om deze automatiseringen beschikbaar te maken.
            </p>
          </div>
        </div>
      )}

      {visibleJobs.length === 0 && eboekhoudenEnabled && (
        <div className="text-center py-16 text-gray-500">
          <RefreshCw size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Geen automatiseringen gevonden</p>
        </div>
      )}

      <p className="text-xs text-gray-600 text-right">
        Bijgewerkt: {lastRefresh.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
