-- Grant execute on populate_search_vector_batch to authenticated
GRANT EXECUTE ON FUNCTION public.populate_search_vector_batch(text, integer) TO authenticated;

-- Also fix: make the function callable by the API role
GRANT EXECUTE ON FUNCTION public.populate_search_vector_batch(text, integer) TO anon;