// Emit one item per completed contact so Mark OQ Archived can update each row.
// Reads _archive_payload stored by Filter + Join + Dedup (n05).
const payload = $('Filter + Join + Dedup').first().json._archive_payload || [];
return payload.map(item => ({ json: { opportunity_id: item.opportunity_id } }));
