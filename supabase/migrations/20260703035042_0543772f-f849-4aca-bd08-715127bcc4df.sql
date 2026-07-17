
REVOKE EXECUTE ON FUNCTION public.notify_payable_due() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scan_payables_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_payables_due() TO service_role;
