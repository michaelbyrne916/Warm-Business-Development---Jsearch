return $input.all().map(item => ({
  json: {
    ...item.json,
    _apollo_body: JSON.stringify({
      organization_domains: [item.json.company_domain].filter(Boolean),
      person_titles: ['director','vp','vice president','head','manager','chief','cto','coo','ceo','founder','president','owner'],
      per_page: 5
    })
  }
}));
