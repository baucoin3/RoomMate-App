-- Link expenses to receipts for PostgREST embeds and referential integrity
ALTER TABLE public.expenses
ADD CONSTRAINT expenses_receipt_id_fkey
FOREIGN KEY (receipt_id) REFERENCES public.receipts(id) ON DELETE SET NULL;
