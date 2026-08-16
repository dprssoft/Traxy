// Stub: will load collection items from local SQLite during collections implementation.
export const load = async ({ params }: { params: { id: string } }) => {
	return { collectionId: params.id, items: [] };
};