// Reviewed OpenCLI 1.8.6 field mappings. Nulls stay missing; no runtime fuzzy matching.
export const TOOL_PRESENTATIONS={
  "opencli.hackernews.top": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "title",
      "subtitle": "author",
      "metric": "score",
      "url": "url"
    },
    "metricLabel": "热度"
  },
  "opencli.hackernews.best": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "title",
      "subtitle": "author",
      "metric": "score",
      "url": "url"
    },
    "metricLabel": "热度"
  },
  "opencli.hackernews.new": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "title",
      "subtitle": "author",
      "metric": "score",
      "url": "url"
    },
    "metricLabel": "热度"
  },
  "opencli.hackernews.search": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "title",
      "subtitle": "author",
      "metric": "score",
      "url": "url"
    },
    "metricLabel": "热度"
  },
  "opencli.google.news": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "title",
      "url": "url"
    }
  },
  "opencli.bbc.news": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "title",
      "url": "url"
    }
  },
  "opencli.bbc.topic": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "title",
      "url": "url"
    }
  },
  "opencli.36kr.news": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "title",
      "url": "url"
    }
  },
  "opencli.weibo.search": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "subtitle": "author",
      "url": "url"
    },
    "metricLabel": "平台互动指标"
  },
  "opencli.xiaohongshu.search": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "subtitle": "author",
      "url": "url"
    },
    "metricLabel": "平台互动指标"
  },
  "opencli.bilibili.search": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "subtitle": "author",
      "url": "url"
    },
    "metricLabel": "平台互动指标"
  },
  "opencli.bilibili.hot": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "subtitle": "author",
      "url": "url"
    },
    "metricLabel": "平台互动指标"
  },
  "opencli.weibo.comments": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "text",
      "subtitle": "author",
      "metric": "likes",
      "time": "time"
    },
    "metricLabel": "点赞"
  },
  "opencli.xiaohongshu.comments": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "text",
      "subtitle": "author",
      "metric": "likes",
      "time": "time"
    },
    "metricLabel": "点赞"
  },
  "opencli.bilibili.comments": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "text",
      "subtitle": "author",
      "metric": "likes",
      "time": "time"
    },
    "metricLabel": "点赞"
  },
  "opencli.youtube.comments": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "text",
      "subtitle": "author",
      "metric": "likes",
      "time": "time"
    },
    "metricLabel": "点赞"
  },
  "opencli.douban.top250": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "metric": "rating",
      "url": "url"
    },
    "metricLabel": "豆瓣评分"
  },
  "opencli.douban.movie-hot": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "metric": "rating",
      "url": "url"
    },
    "metricLabel": "豆瓣评分"
  },
  "opencli.douban.search": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "metric": "rating",
      "url": "url"
    },
    "metricLabel": "豆瓣评分"
  },
  "opencli.douban.book-hot": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "metric": "rating",
      "url": "url"
    },
    "metricLabel": "豆瓣评分"
  },
  "opencli.youtube.search": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "subtitle": "channel",
      "time": "duration",
      "metric": "views",
      "url": "url"
    },
    "metricLabel": "播放量"
  },
  "opencli.youtube.playlist": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "subtitle": "channel",
      "time": "duration",
      "metric": "views",
      "url": "url"
    },
    "metricLabel": "播放量"
  },
  "opencli.youtube.watch-later": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "subtitle": "channel",
      "time": "duration",
      "metric": "views",
      "url": "url"
    },
    "metricLabel": "播放量"
  },
  "opencli.apple-podcasts.search": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "subtitle": "author"
    }
  },
  "opencli.apple-podcasts.top": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "subtitle": "author"
    }
  },
  "opencli.spotify.search": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "track",
      "subtitle": "artist",
      "facet": "album"
    }
  },
  "opencli.spotify.status": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "track",
      "subtitle": "artist",
      "facet": "album"
    }
  },
  "opencli.douban.photos": {
    "version": 1,
    "kind": "media",
    "fields": {
      "title": "title",
      "url": "detail_url"
    },
    "allowUntitled": true
  },
  "opencli.douban.subject": {
    "version": 1,
    "kind": "detail",
    "fields": {
      "title": "title",
      "subtitle": "originalTitle",
      "summary": "summary",
      "metric": "rating",
      "facet": "genres",
      "url": "url"
    },
    "metricLabel": "豆瓣评分"
  },
  "opencli.wikipedia.summary": {
    "version": 1,
    "kind": "detail",
    "fields": {
      "title": "title",
      "subtitle": "description",
      "summary": "extract",
      "url": "url"
    }
  },
  "opencli.wikipedia.page": {
    "version": 1,
    "kind": "detail",
    "fields": {
      "title": "title",
      "subtitle": "description",
      "summary": "extract",
      "url": "url"
    }
  },
  "opencli.wikipedia.random": {
    "version": 1,
    "kind": "detail",
    "fields": {
      "title": "title",
      "subtitle": "description",
      "summary": "extract",
      "url": "url"
    }
  },
  "opencli.weread.book": {
    "version": 1,
    "kind": "detail",
    "fields": {
      "title": "title",
      "subtitle": "author",
      "summary": "intro",
      "facet": "category",
      "metric": "rating"
    },
    "metricLabel": "评分"
  },
  "opencli.jd.item": {
    "version": 1,
    "kind": "detail",
    "fields": {
      "title": "title",
      "subtitle": "shop",
      "metric": "price",
      "summary": "specs"
    },
    "metricLabel": "来源价格"
  },
  "opencli.12306.trains": {
    "version": 1,
    "kind": "route",
    "fields": {
      "title": "code",
      "from": "from_station",
      "to": "to_station",
      "departure": "start_time",
      "arrival": "arrive_time",
      "time": "duration",
      "metric": "second_seat",
      "facet": "departure_date"
    },
    "metricLabel": "二等座"
  },
  "opencli.ctrip.flight": {
    "version": 1,
    "kind": "route",
    "fields": {
      "title": "flightNo",
      "subtitle": "airline",
      "from": "departureAirport",
      "to": "arrivalAirport",
      "departure": "departureTime",
      "arrival": "arrivalTime",
      "metric": "price",
      "facet": "cabin",
      "url": "url"
    },
    "metricLabel": "来源票价"
  },
  "opencli.ctrip.search": {
    "version": 1,
    "kind": "places",
    "fields": {
      "title": "name",
      "facet": "cityName",
      "metric": "score",
      "lat": "lat",
      "lon": "lon",
      "url": "url"
    },
    "metricLabel": "来源评分"
  },
  "opencli.ctrip.hotel-search": {
    "version": 1,
    "kind": "places",
    "fields": {
      "title": "name",
      "facet": "cityName",
      "metric": "score",
      "lat": "lat",
      "lon": "lon",
      "url": "url"
    },
    "metricLabel": "来源评分"
  },
  "opencli.ctrip.hotel-suggest": {
    "version": 1,
    "kind": "places",
    "fields": {
      "title": "name",
      "facet": "cityName",
      "metric": "score",
      "lat": "lat",
      "lon": "lon",
      "url": "url"
    },
    "metricLabel": "来源评分"
  },
  "opencli.dianping.search": {
    "version": 1,
    "kind": "places",
    "fields": {
      "title": "name",
      "subtitle": "cuisine",
      "facet": "district",
      "metric": "rating",
      "url": "url"
    },
    "metricLabel": "大众点评评分"
  },
  "opencli.wttr.current": {
    "version": 1,
    "kind": "weather",
    "fields": {
      "title": "location",
      "subtitle": "description",
      "metric": "tempC",
      "secondary": "feelsLikeC",
      "time": "observedAt",
      "facet": "region"
    },
    "metricLabel": "气温 °C"
  },
  "opencli.wttr.forecast": {
    "version": 1,
    "kind": "weather",
    "fields": {
      "title": "date",
      "subtitle": "description",
      "metric": "maxTempC",
      "secondary": "minTempC",
      "time": "sunset"
    },
    "metricLabel": "最高 °C",
    "secondaryLabel": "最低 °C"
  },
  "opencli.dongchedi.score": {
    "version": 1,
    "kind": "metrics",
    "fields": {
      "title": "dimension",
      "metric": "score",
      "secondary": "same_level_avg"
    },
    "metricLabel": "评分",
    "secondaryLabel": "同级均值"
  },
  "opencli.eastmoney.kline": {
    "version": 1,
    "kind": "metrics",
    "fields": {
      "title": "date",
      "metric": "close",
      "secondary": "open",
      "time": "date"
    },
    "metricLabel": "收盘",
    "secondaryLabel": "开盘"
  },
  "opencli.eastmoney.rank": {
    "version": 1,
    "kind": "metrics",
    "fields": {
      "title": "name",
      "metric": "changePercent",
      "secondary": "price"
    },
    "metricLabel": "涨跌幅 %",
    "secondaryLabel": "价格"
  },
  "opencli.eastmoney.quote": {
    "version": 1,
    "kind": "metrics",
    "fields": {
      "title": "name",
      "metric": "changePercent",
      "secondary": "price"
    },
    "metricLabel": "涨跌幅 %",
    "secondaryLabel": "价格"
  },
  "opencli.xiaohongshu.creator-stats": {
    "version": 1,
    "kind": "metrics",
    "fields": {
      "title": "metric",
      "metric": "total",
      "subtitle": "trend"
    },
    "metricLabel": "来源统计"
  },
  "opencli.spotify.play": {
    "version": 1,
    "kind": "receipt",
    "fields": {
      "title": "track",
      "subtitle": "artist",
      "summary": "status"
    },
    "allowUntitled": true
  },
  "opencli.spotify.pause": {
    "version": 1,
    "kind": "receipt",
    "fields": {
      "title": "status"
    },
    "allowUntitled": true
  },
  "opencli.spotify.next": {
    "version": 1,
    "kind": "receipt",
    "fields": {
      "title": "status"
    },
    "allowUntitled": true
  },
  "opencli.spotify.prev": {
    "version": 1,
    "kind": "receipt",
    "fields": {
      "title": "status"
    },
    "allowUntitled": true
  },
  "opencli.spotify.volume": {
    "version": 1,
    "kind": "receipt",
    "fields": {
      "title": "volume"
    },
    "allowUntitled": true
  },
  "opencli.spotify.queue": {
    "version": 1,
    "kind": "receipt",
    "fields": {
      "title": "track",
      "subtitle": "artist",
      "summary": "status"
    },
    "allowUntitled": true
  },
  "opencli.spotify.repeat": {
    "version": 1,
    "kind": "receipt",
    "fields": {
      "title": "repeat"
    },
    "allowUntitled": true
  },
  "opencli.spotify.shuffle": {
    "version": 1,
    "kind": "receipt",
    "fields": {
      "title": "shuffle"
    },
    "allowUntitled": true
  },
  "opencli.jd.add-cart": {
    "version": 1,
    "kind": "receipt",
    "fields": {
      "title": "title",
      "subtitle": "status",
      "metric": "price"
    },
    "allowUntitled": true
  },
  "opencli.yollomi.remove-bg": {
    "version": 1,
    "kind": "receipt",
    "fields": {
      "title": "status",
      "subtitle": "file",
      "url": "url"
    },
    "allowUntitled": true
  },
  "opencli.yollomi.restore": {
    "version": 1,
    "kind": "receipt",
    "fields": {
      "title": "status",
      "subtitle": "file",
      "url": "url"
    },
    "allowUntitled": true
  },
  "opencli.yollomi.upscale": {
    "version": 1,
    "kind": "receipt",
    "fields": {
      "title": "status",
      "subtitle": "file",
      "url": "url"
    },
    "allowUntitled": true
  },
  "opencli.yollomi.background": {
    "version": 1,
    "kind": "receipt",
    "fields": {
      "title": "status",
      "subtitle": "file",
      "url": "url"
    },
    "allowUntitled": true
  },
  "autocli.hackernews.top": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "title",
      "subtitle": "author",
      "metric": "score",
      "url": "url"
    },
    "metricLabel": "来源积分/回应"
  },
  "autocli.hackernews.search": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "title",
      "subtitle": "author",
      "metric": "score",
      "url": "url"
    },
    "metricLabel": "来源积分/回应"
  },
  "autocli.devto.top": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "title",
      "subtitle": "author",
      "metric": "score",
      "url": "url"
    },
    "metricLabel": "来源积分/回应"
  },
  "autocli.lobsters.hot": {
    "version": 1,
    "kind": "feed",
    "fields": {
      "title": "title",
      "subtitle": "author",
      "metric": "score",
      "url": "url"
    },
    "metricLabel": "来源积分/回应"
  }
}
