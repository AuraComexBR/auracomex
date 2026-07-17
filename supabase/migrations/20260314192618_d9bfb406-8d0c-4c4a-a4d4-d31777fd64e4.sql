
-- Allow authenticated users to INSERT ports
CREATE POLICY "Authenticated users can insert ports"
ON public.ports
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to UPDATE ports
CREATE POLICY "Authenticated users can update ports"
ON public.ports
FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to DELETE ports
CREATE POLICY "Authenticated users can delete ports"
ON public.ports
FOR DELETE
TO authenticated
USING (true);
