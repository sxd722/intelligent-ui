// Pinned adapter limitations shared by normalization and generation. Kept apart
// from the generated upstream manifest so contract sync cannot erase them.
export const TOOL_SEMANTICS = {
  'opencli.douban.search': {
    // v1.8.6 searchDouban returns these fields beyond its table columns.
    // Disclose the retained JSON fields, not only the upstream table header.
    additionalFields:['id','type','cover'],
    fieldSemantics:{
      id:'Real subject ID returned by the search adapter. Pass id + type to douban.subject; never substitute title or rowKey. If absent, disable detail lookup and offer the source link.',
      type:'Returned entity type: movie/book/music. subject supports movie/book only; do not query movie details for music.',
      rank:'Search result order only, not a popularity/rating ranking. keyword is text search, not a guaranteed genre/category filter.',
      cover:'Optional real cover image URL returned by the source; the host result browser can show it.',
    },
  },
  'opencli.ctrip.hotel-search': {
    resultScope: 'first-page',
    fieldSemantics: {
      scope: 'Only the initial city-wide SSR page (usually 10–13 hotels), never a complete city inventory. limit is a cap, not a promise to retrieve more pages.',
      city: 'Use a selected suggestion cityId. Does not accept keyword, district, landmark or distance filters; city resolution does not apply those filters.',
      price: 'May be null in SSR data. Null means unavailable, not free or sold out. Do not claim a live quote or bookable room without source evidence.',
      filtering: 'Local name filtering only searches fetched hotel names, not hotels near a landmark. Keep city resolution and local name-filter inputs separate; offer the official source when area search is unsupported.',
    },
  },
  'opencli.ctrip.hotel-suggest': {
    fieldSemantics: {
      type: 'Mixed City/Hotel/BusinessArea/etc suggestions, not room availability or a hotel inventory.',
      cityId: 'City scope only. Reusing this ID in hotel-search loses the business-area/hotel/landmark constraint. Select the matching city explicitly; do not blindly take the first unrelated suggestion.',
    },
  },
}
