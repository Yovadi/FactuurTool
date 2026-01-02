import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qlvndvpxhqmjljjpehkn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdm5kdnB4aHFtamxqanBlaGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5MjI1MzQsImV4cCI6MjA3NjQ5ODUzNH0.q1Kel_GCQqUx2J5Nd9WFOVz7okodFPcoAJkKL6YVkUk';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Tenant = {
  id: string;
  company_name: string;
  name: string;
  email: string;
  phone: string | null;
  billing_address: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  booking_pin_code: string | null;
  created_at: string;
};

export type ExternalCustomer = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  booking_pin_code: string | null;
  created_at: string;
  updated_at?: string;
};

export type OfficeSpace = {
  id: string;
  space_number: string;
  floor: number;
  square_footage: number;
  base_rent: number;
  is_available: boolean;
  is_furnished: boolean | null;
  space_type: 'bedrijfsruimte' | 'kantoor' | 'buitenterrein' | 'diversen' | 'Meeting Room' | 'Flexplek';
  hourly_rate?: number | null;
  half_day_rate?: number | null;
  full_day_rate?: number | null;
  rate_per_sqm?: number | null;
  daily_rate?: number | null;
  is_flex_space?: boolean;
  flex_capacity?: number;
  created_at: string;
};

export type Lease = {
  id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  security_deposit: number;
  status: 'active' | 'expired' | 'terminated';
  vat_rate: number;
  vat_inclusive: boolean;
  lease_type: 'full_time' | 'flex';
  flex_pricing_model: 'daily' | 'monthly_unlimited' | 'credit_based' | null;
  flex_daily_rate: number | null;
  flex_monthly_rate: number | null;
  credits_per_week: number | null;
  flex_credit_rate: number | null;
  created_at: string;
};

export type LeaseSpace = {
  id: string;
  lease_id: string;
  space_id: string;
  price_per_sqm: number;
  monthly_rent: number;
  created_at: string;
};

export type Invoice = {
  id: string;
  lease_id: string | null;
  tenant_id: string | null;
  external_customer_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  invoice_month: string | null;
  subtotal: number;
  vat_amount: number;
  amount: number;
  vat_rate: number;
  vat_inclusive: boolean;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  notes: string | null;
  created_at: string;
  paid_at: string | null;
};

export type InvoiceLineItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
};

export type CompanySettings = {
  id: string;
  company_name: string;
  name: string | null;
  address: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  vat_number: string;
  kvk_number: string;
  bank_account: string;
  delete_code: string;
  root_folder_path: string | null;
  test_mode: boolean;
  test_date: string | null;
  wifi_network_name: string | null;
  wifi_password: string | null;
  patch_points: string | null;
  meter_cabinet_info: string | null;
  building_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SpaceTypeRate = {
  id: string;
  space_type: string;
  rate_per_sqm: number;
  rate_per_sqm_furnished: number;
  calculation_method: 'per_sqm' | 'fixed_monthly' | 'hourly' | 'custom' | 'daily';
  fixed_rate: number;
  fixed_rate_furnished: number;
  hourly_rate: number;
  half_day_rate: number;
  half_day_rate_furnished: number;
  full_day_rate: number;
  full_day_rate_furnished: number;
  daily_rate: number;
  daily_rate_furnished: number;
  is_annual: boolean;
  description: string;
  description_furnished: string;
  created_at: string;
  updated_at: string;
};

export type WifiNetwork = {
  id: string;
  network_name: string;
  password: string;
  network_number: number;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PatchPort = {
  id: string;
  switch_number: number;
  port_number: number;
  location_description: string;
  created_at: string;
  updated_at: string;
};
