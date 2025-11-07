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
  name: string;
  email: string;
  phone: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  booking_pin_code: string | null;
  created_at: string;
};

export type OfficeSpace = {
  id: string;
  space_number: string;
  floor: number;
  square_footage: number;
  base_rent: number;
  is_available: boolean;
  space_type: 'bedrijfsruimte' | 'kantoor' | 'buitenterrein' | 'diversen';
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
  created_at: string;
  updated_at: string;
};
