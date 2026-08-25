-- Track Stripe invoice payment outcomes for The Great Van Plan.

alter type public.van_plan_invoice_status add value if not exists 'paid';
alter type public.van_plan_invoice_status add value if not exists 'voided';
alter type public.van_plan_invoice_status add value if not exists 'uncollectible';
