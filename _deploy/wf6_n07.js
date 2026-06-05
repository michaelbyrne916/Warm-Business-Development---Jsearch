// Strip helper fields before Sequence Tracker write (_company_for_summary is not a sheet column).
return $json.to_add.map(contact => {
  const { _company_for_summary, ...clean } = contact;
  return { json: clean };
});
