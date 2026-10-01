function stationSummary(s) {
  return {
    stationuuid: s.stationuuid,
    name: s.name,
    url: s.url_resolved || s.url,
    favicon: s.favicon || "",
    tags: s.tags || "",
    country: s.country || "",
    countrycode: s.countrycode || "",
    state: s.state || "",
    bitrate: s.bitrate || 0,
    codec: s.codec || "",
  };
}

module.exports = { stationSummary };
