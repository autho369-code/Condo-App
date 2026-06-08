SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('bank_accounts', 'payable_bills', 'violations', 'work_orders') 
ORDER BY tablename, policyname;
