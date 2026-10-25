// Generated from @jackwener/opencli 1.8.6; edit selection in scripts/sync-opencli-contract.mjs.
export const OPENCLI_DEFINITIONS = [
  {
    "id": "opencli.12306.stations",
    "provider": "opencli",
    "group": "travel",
    "site": "12306",
    "command": "stations",
    "module": "12306/stations.js",
    "description": "Search 12306 (China Railway) stations by Chinese name, telecode, or pinyin keyword",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "keyword"
      ],
      "properties": {
        "keyword": {
          "type": "string",
          "description": "Chinese substring (上海), telecode (AOH), or pinyin (shanghai)",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Maximum results (1-50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "name",
      "code",
      "pinyin",
      "abbr",
      "city"
    ],
    "mapping": {
      "keyword": "keyword",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.12306.trains",
    "provider": "opencli",
    "group": "travel",
    "site": "12306",
    "command": "trains",
    "module": "12306/trains.js",
    "description": "List trains between two 12306 stations on a given date (anonymous, no login required) Host filters exact stations and departureAfter/departureBefore BEFORE limit. Use these arguments for time ranges instead of filtering a limited list. available/bookable are booking flags, NOT ticket counts; display second_seat/first_seat/etc. Use rowKey for selection, code is not unique.",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "from",
        "to",
        "date"
      ],
      "properties": {
        "from": {
          "type": "string",
          "description": "Origin station: Chinese name (北京), telecode (BJP), or pinyin (beijing)",
          "maxLength": 300,
          "minLength": 1
        },
        "to": {
          "type": "string",
          "description": "Destination station: same forms as <from>",
          "maxLength": 300,
          "minLength": 1
        },
        "date": {
          "type": "string",
          "description": "Departure date in YYYY-MM-DD",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Maximum rows (1-100)",
          "minimum": 1,
          "maximum": 100
        },
        "departureAfter": {
          "type": "string",
          "description": "Departure at or after HH:MM, default 00:00; afternoon uses 12:00",
          "maxLength": 5,
          "minLength": 5
        },
        "departureBefore": {
          "type": "string",
          "description": "Departure before HH:MM, default 24:00; afternoon uses 18:00",
          "maxLength": 5,
          "minLength": 5
        },
        "exactStations": {
          "type": "boolean",
          "description": "Exact requested stations, default true; false explicitly includes nearby city stations"
        }
      }
    },
    "columns": [
      "code",
      "from_station",
      "to_station",
      "start_time",
      "arrive_time",
      "duration",
      "available",
      "business_seat",
      "first_seat",
      "second_seat",
      "soft_sleeper",
      "hard_sleeper",
      "hard_seat",
      "no_seat",
      "train_no",
      "departure_date",
      "bookable"
    ],
    "identityFields": [
      "train_no",
      "from_station",
      "to_station",
      "departure_date"
    ],
    "nullableEmptyFields": [
      "business_seat",
      "first_seat",
      "second_seat",
      "soft_sleeper",
      "hard_sleeper",
      "hard_seat",
      "no_seat"
    ],
    "fieldTypes": {
      "available": "boolean",
      "bookable": "boolean"
    },
    "filterInputs": {
      "start_time": [
        "departureAfter",
        "departureBefore"
      ]
    },
    "fieldSemantics": {
      "available": "boolean booking flag, not seat availability",
      "bookable": "boolean booking flag",
      "second_seat": "seat availability: 有/无/count/empty (unknown)"
    },
    "mapping": {
      "from": "from",
      "to": "to",
      "date": "date",
      "limit": "limit",
      "departureAfter": "departureAfter",
      "departureBefore": "departureBefore",
      "exactStations": "exactStations"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.12306.price",
    "provider": "opencli",
    "group": "travel",
    "site": "12306",
    "command": "price",
    "module": "12306/price.js",
    "description": "Look up 12306 ticket prices by seat class for one train on a given date and segment (anonymous, no login required) Use trainNo=row.train_no, from=row.from_station, to=row.to_station from the selected trains result. Do not reuse the original station filters.",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "trainNo",
        "from",
        "to",
        "date"
      ],
      "properties": {
        "trainNo": {
          "type": "string",
          "description": "Internal train_no from `12306 trains` (e.g. 24000000G10L)",
          "maxLength": 300,
          "minLength": 1
        },
        "from": {
          "type": "string",
          "description": "Origin station (Chinese name, telecode, or pinyin) - must be a stop of this train",
          "maxLength": 300,
          "minLength": 1
        },
        "to": {
          "type": "string",
          "description": "Destination station - must be a stop of this train",
          "maxLength": 300,
          "minLength": 1
        },
        "date": {
          "type": "string",
          "description": "Departure date in YYYY-MM-DD",
          "maxLength": 300,
          "minLength": 1
        },
        "seatTypes": {
          "type": "string",
          "description": "Seat-type letters to query (default covers the common classes). Examples: OM9 (二等/一等/商务), A1A3A4 (硬座/硬卧/软卧).",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "seat_code",
      "seat_name",
      "price",
      "currency"
    ],
    "mapping": {
      "trainNo": "train-no",
      "from": "from",
      "to": "to",
      "date": "date",
      "seatTypes": "seat-types"
    },
    "defaults": {
      "seat-types": "OM9PA1A3A4FWZ"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.12306.train",
    "provider": "opencli",
    "group": "travel",
    "site": "12306",
    "command": "train",
    "module": "12306/train.js",
    "description": "List every station a 12306 train calls at, with arrival / departure / stopover time (anonymous, no login required) Use trainNo=row.train_no, from=row.from_station, to=row.to_station from the selected trains result. Do not reuse the original station filters.",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "trainNo",
        "from",
        "to",
        "date"
      ],
      "properties": {
        "trainNo": {
          "type": "string",
          "description": "Internal train_no from `12306 trains` (e.g. 24000000G10L), not the public code (G1)",
          "maxLength": 300,
          "minLength": 1
        },
        "from": {
          "type": "string",
          "description": "Origin station for the segment: Chinese name, telecode, or pinyin",
          "maxLength": 300,
          "minLength": 1
        },
        "to": {
          "type": "string",
          "description": "Destination station for the segment",
          "maxLength": 300,
          "minLength": 1
        },
        "date": {
          "type": "string",
          "description": "Departure date in YYYY-MM-DD",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "station_no",
      "station_name",
      "arrive_time",
      "start_time",
      "stopover_time"
    ],
    "mapping": {
      "trainNo": "train-no",
      "from": "from",
      "to": "to",
      "date": "date"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.wttr.current",
    "provider": "opencli",
    "group": "weather",
    "site": "wttr",
    "command": "current",
    "module": "wttr/current.js",
    "description": "Current weather conditions for a location (city, lat,lon, or airport code)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "location"
      ],
      "properties": {
        "location": {
          "type": "string",
          "description": "City name, \"lat,lon\", airport ICAO code, or \"@domain\"",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "location",
      "region",
      "country",
      "latitude",
      "longitude",
      "observedAt",
      "tempC",
      "tempF",
      "feelsLikeC",
      "feelsLikeF",
      "description",
      "humidity",
      "cloudCover",
      "pressure",
      "precipMm",
      "visibilityKm",
      "uvIndex",
      "windKmph",
      "windDirection",
      "windDirectionDegree"
    ],
    "mapping": {
      "location": "location"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.wttr.forecast",
    "provider": "opencli",
    "group": "weather",
    "site": "wttr",
    "command": "forecast",
    "module": "wttr/forecast.js",
    "description": "Multi-day weather forecast (up to 3 days, wttr.in free tier max)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "location"
      ],
      "properties": {
        "location": {
          "type": "string",
          "description": "City name, \"lat,lon\", airport ICAO code, or \"@domain\"",
          "maxLength": 300,
          "minLength": 1
        },
        "days": {
          "type": "integer",
          "description": "Max forecast days (1-3, wttr.in caps the response at 3 days)",
          "minimum": 1,
          "maximum": 3
        }
      }
    },
    "columns": [
      "rank",
      "date",
      "minTempC",
      "maxTempC",
      "avgTempC",
      "minTempF",
      "maxTempF",
      "avgTempF",
      "sunHour",
      "totalSnowCm",
      "uvIndex",
      "description",
      "sunrise",
      "sunset"
    ],
    "mapping": {
      "location": "location",
      "days": "days"
    },
    "defaults": {
      "days": 3
    },
    "idTypes": {}
  },
  {
    "id": "opencli.douban.search",
    "provider": "opencli",
    "group": "movies",
    "site": "douban",
    "command": "search",
    "module": "douban/search.js",
    "description": "搜索豆瓣电影、图书或音乐",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "keyword"
      ],
      "properties": {
        "type": {
          "type": "string",
          "description": "搜索类型（movie=电影, book=图书, music=音乐）",
          "maxLength": 300,
          "enum": [
            "movie",
            "book",
            "music"
          ]
        },
        "keyword": {
          "type": "string",
          "description": "搜索关键词",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "返回结果数量",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "rating",
      "abstract",
      "url"
    ],
    "mapping": {
      "type": "type",
      "keyword": "keyword",
      "limit": "limit"
    },
    "defaults": {
      "type": "movie",
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.douban.subject",
    "provider": "opencli",
    "group": "movies",
    "site": "douban",
    "command": "subject",
    "module": "douban/subject.js",
    "description": "获取豆瓣条目详情",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "豆瓣条目 ID",
          "maxLength": 128,
          "minLength": 1
        },
        "type": {
          "type": "string",
          "description": "条目类型（movie=电影, book=图书）",
          "maxLength": 300,
          "enum": [
            "movie",
            "book"
          ]
        }
      }
    },
    "columns": [
      "id",
      "type",
      "title",
      "subtitle",
      "originalTitle",
      "authors",
      "translators",
      "publisher",
      "publishDate",
      "publishYear",
      "pageCount",
      "binding",
      "price",
      "series",
      "isbn10",
      "isbn13",
      "year",
      "rating",
      "ratingCount",
      "genres",
      "directors",
      "casts",
      "country",
      "duration",
      "summary",
      "url"
    ],
    "mapping": {
      "id": "id",
      "type": "type"
    },
    "defaults": {
      "type": "movie"
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.douban.movie-hot",
    "provider": "opencli",
    "group": "movies",
    "site": "douban",
    "command": "movie-hot",
    "module": "douban/movie-hot.js",
    "description": "豆瓣电影热门榜单",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "返回的电影数量",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "rating",
      "votes",
      "year",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.douban.photos",
    "provider": "opencli",
    "group": "movies",
    "site": "douban",
    "command": "photos",
    "module": "douban/photos.js",
    "description": "获取电影海报/剧照图片列表",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "电影 subject ID",
          "maxLength": 128,
          "minLength": 1
        },
        "type": {
          "type": "string",
          "description": "豆瓣 photos 的 type 参数，默认 Rb（海报）",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "最多返回多少张图片",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "index",
      "photo_id",
      "subject_id",
      "title",
      "image_url",
      "detail_url"
    ],
    "mapping": {
      "id": "id",
      "type": "type",
      "limit": "limit"
    },
    "defaults": {
      "type": "Rb",
      "limit": 20
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.douban.top250",
    "provider": "opencli",
    "group": "movies",
    "site": "douban",
    "command": "top250",
    "module": "douban/top250.js",
    "description": "豆瓣电影 Top250",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "返回结果数量",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "rating",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.douban.book-hot",
    "provider": "opencli",
    "group": "movies",
    "site": "douban",
    "command": "book-hot",
    "module": "douban/book-hot.js",
    "description": "豆瓣图书热门榜单",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "返回的图书数量",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "rating",
      "quote",
      "author",
      "publisher",
      "year",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.douban.marks",
    "provider": "opencli",
    "group": "movies",
    "site": "douban",
    "command": "marks",
    "module": "douban/marks.js",
    "description": "导出个人观影标记",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "status": {
          "type": "string",
          "description": "标记类型: collect(看过), wish(想看), do(在看), all(全部)",
          "maxLength": 300,
          "enum": [
            "collect",
            "wish",
            "do",
            "all"
          ]
        },
        "limit": {
          "type": "integer",
          "description": "导出数量， 0 表示全部",
          "minimum": 1,
          "maximum": 20
        },
        "uid": {
          "type": [
            "string",
            "integer"
          ],
          "description": "用户ID，不填则使用当前登录账号",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "title",
      "year",
      "myRating",
      "myStatus",
      "myDate",
      "myComment",
      "url"
    ],
    "mapping": {
      "status": "status",
      "limit": "limit",
      "uid": "uid"
    },
    "defaults": {
      "status": "collect",
      "limit": 20
    },
    "idTypes": {
      "uid": "string"
    }
  },
  {
    "id": "opencli.douban.reviews",
    "provider": "opencli",
    "group": "movies",
    "site": "douban",
    "command": "reviews",
    "module": "douban/reviews.js",
    "description": "导出个人影评",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "导出数量",
          "minimum": 1,
          "maximum": 20
        },
        "uid": {
          "type": [
            "string",
            "integer"
          ],
          "description": "用户ID，不填则使用当前登录账号",
          "maxLength": 128,
          "minLength": 1
        },
        "full": {
          "type": "boolean",
          "description": "获取完整影评内容"
        }
      }
    },
    "columns": [
      "movieTitle",
      "title",
      "myRating",
      "votes",
      "content",
      "url"
    ],
    "mapping": {
      "limit": "limit",
      "uid": "uid",
      "full": "full"
    },
    "defaults": {
      "limit": 20,
      "full": false
    },
    "idTypes": {
      "uid": "string"
    }
  },
  {
    "id": "opencli.weread.shelf",
    "provider": "opencli",
    "group": "reading",
    "site": "weread",
    "command": "shelf",
    "module": "weread/shelf.js",
    "description": "List books on your WeRead bookshelf",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Max results",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "title",
      "author",
      "progress",
      "bookId"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.weread.highlights",
    "provider": "opencli",
    "group": "reading",
    "site": "weread",
    "command": "highlights",
    "module": "weread/highlights.js",
    "description": "List your highlights (underlines) in a book",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "bookId"
      ],
      "properties": {
        "bookId": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Book ID (from shelf or search results)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max results",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "chapter",
      "text",
      "createTime"
    ],
    "mapping": {
      "bookId": "book-id",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {
      "bookId": "string"
    }
  },
  {
    "id": "opencli.weread.notes",
    "provider": "opencli",
    "group": "reading",
    "site": "weread",
    "command": "notes",
    "module": "weread/notes.js",
    "description": "List your notes (thoughts) on a book",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "bookId"
      ],
      "properties": {
        "bookId": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Book ID (from shelf or search results)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max results",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "chapter",
      "text",
      "review",
      "createTime"
    ],
    "mapping": {
      "bookId": "book-id",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {
      "bookId": "string"
    }
  },
  {
    "id": "opencli.weread.search",
    "provider": "opencli",
    "group": "reading",
    "site": "weread",
    "command": "search",
    "module": "weread/search.js",
    "description": "Search books on WeRead",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search keyword",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max results",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "author",
      "bookId",
      "url"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit"
    },
    "defaults": {
      "limit": 10
    },
    "idTypes": {}
  },
  {
    "id": "opencli.weread.book",
    "provider": "opencli",
    "group": "reading",
    "site": "weread",
    "command": "book",
    "module": "weread/book.js",
    "description": "View book details on WeRead",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "bookId"
      ],
      "properties": {
        "bookId": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Book ID from search or shelf results",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "title",
      "author",
      "publisher",
      "intro",
      "category",
      "rating"
    ],
    "mapping": {
      "bookId": "book-id"
    },
    "defaults": {},
    "idTypes": {
      "bookId": "string"
    }
  },
  {
    "id": "opencli.weread.book-search",
    "provider": "opencli",
    "group": "reading",
    "site": "weread",
    "command": "book-search",
    "module": "weread/book-search.js",
    "description": "Search within a WeRead book after resolving it by title",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "book",
        "query"
      ],
      "properties": {
        "book": {
          "type": "string",
          "description": "Book title keyword, numeric bookId, or reader URL",
          "maxLength": 300,
          "minLength": 1
        },
        "query": {
          "type": "string",
          "description": "Keyword to search inside the selected book",
          "maxLength": 300,
          "minLength": 1
        },
        "bookRank": {
          "type": "integer",
          "description": "Which book search result to use when book is a title keyword",
          "minimum": 1,
          "maximum": 20
        },
        "limit": {
          "type": "integer",
          "description": "Max in-book matches to return (1-100)",
          "minimum": 1,
          "maximum": 20
        },
        "fragmentSize": {
          "type": "integer",
          "description": "Snippet length around each match (1-500)",
          "minimum": 20,
          "maximum": 500
        },
        "raw": {
          "type": "boolean",
          "description": "Output structured rows instead of markdown text"
        }
      }
    },
    "columns": [],
    "mapping": {
      "book": "book",
      "query": "query",
      "bookRank": "book-rank",
      "limit": "limit",
      "fragmentSize": "fragment-size",
      "raw": "raw"
    },
    "defaults": {
      "book-rank": 1,
      "limit": 20,
      "fragment-size": 150,
      "raw": true
    },
    "idTypes": {}
  },
  {
    "id": "opencli.weread.ranking",
    "provider": "opencli",
    "group": "reading",
    "site": "weread",
    "command": "ranking",
    "module": "weread/ranking.js",
    "description": "WeRead book rankings by category",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "category": {
          "type": "string",
          "description": "Category: all (default), rising, or numeric category ID",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "Max results",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "author",
      "category",
      "readingCount",
      "bookId"
    ],
    "mapping": {
      "category": "category",
      "limit": "limit"
    },
    "defaults": {
      "category": "all",
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.weread.notebooks",
    "provider": "opencli",
    "group": "reading",
    "site": "weread",
    "command": "notebooks",
    "module": "weread/notebooks.js",
    "description": "List books that have highlights or notes",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {}
    },
    "columns": [
      "title",
      "author",
      "noteCount",
      "bookId"
    ],
    "mapping": {},
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.weread.ai-outline",
    "provider": "opencli",
    "group": "reading",
    "site": "weread",
    "command": "ai-outline",
    "module": "weread/ai-outline.js",
    "description": "Get AI-generated outline for a book",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "bookId"
      ],
      "properties": {
        "bookId": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Book ID (from shelf or search results)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max outline items to return",
          "minimum": 1,
          "maximum": 20
        },
        "depth": {
          "type": "integer",
          "description": "Max outline depth (2=topics, 3=key points, 4=details)",
          "minimum": 1,
          "maximum": 4
        },
        "raw": {
          "type": "boolean",
          "description": "Output structured rows (chapter/idx/level/text) for programmatic use"
        }
      }
    },
    "columns": [],
    "mapping": {
      "bookId": "book-id",
      "limit": "limit",
      "depth": "depth",
      "raw": "raw"
    },
    "defaults": {
      "limit": 20,
      "depth": 4,
      "raw": true
    },
    "idTypes": {
      "bookId": "string"
    }
  },
  {
    "id": "opencli.jd.search",
    "provider": "opencli",
    "group": "shopping",
    "site": "jd",
    "command": "search",
    "module": "jd/search.js",
    "description": "京东商品搜索",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "搜索关键词",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "返回结果数量 (max 30)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "price",
      "shop",
      "sku",
      "url"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit"
    },
    "defaults": {
      "limit": 10
    },
    "idTypes": {}
  },
  {
    "id": "opencli.jd.item",
    "provider": "opencli",
    "group": "shopping",
    "site": "jd",
    "command": "item",
    "module": "jd/item.js",
    "description": "京东商品详情（价格、店铺、规格参数、主图、详情图）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "sku"
      ],
      "properties": {
        "sku": {
          "type": "string",
          "description": "商品 SKU ID（如 100291143898）",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "title",
      "price",
      "shop",
      "specs",
      "mainImages",
      "detailImages"
    ],
    "mapping": {
      "sku": "sku"
    },
    "defaults": {
      "images": 8
    },
    "idTypes": {}
  },
  {
    "id": "opencli.jd.reviews",
    "provider": "opencli",
    "group": "shopping",
    "site": "jd",
    "command": "reviews",
    "module": "jd/reviews.js",
    "description": "京东商品评价",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "sku"
      ],
      "properties": {
        "sku": {
          "type": "string",
          "description": "商品 SKU ID",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "返回评价数量 (max 20)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "user",
      "content",
      "date"
    ],
    "mapping": {
      "sku": "sku",
      "limit": "limit"
    },
    "defaults": {
      "limit": 10
    },
    "idTypes": {}
  },
  {
    "id": "opencli.jd.cart",
    "provider": "opencli",
    "group": "shopping",
    "site": "jd",
    "command": "cart",
    "module": "jd/cart.js",
    "description": "查看京东购物车",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {}
    },
    "columns": [
      "index",
      "title",
      "price",
      "quantity",
      "sku"
    ],
    "mapping": {},
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.jd.add-cart",
    "provider": "opencli",
    "group": "shopping",
    "site": "jd",
    "command": "add-cart",
    "module": "jd/add-cart.js",
    "description": "京东加入购物车",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": false,
    "refreshable": false,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "sku"
      ],
      "properties": {
        "sku": {
          "type": "string",
          "description": "商品 SKU ID",
          "maxLength": 300,
          "minLength": 1
        },
        "num": {
          "type": "integer",
          "description": "数量",
          "minimum": 1,
          "maximum": 10
        }
      }
    },
    "columns": [
      "status",
      "title",
      "price",
      "sku"
    ],
    "mapping": {
      "sku": "sku",
      "num": "num"
    },
    "defaults": {
      "num": 1
    },
    "idTypes": {}
  },
  {
    "id": "opencli.jd.detail",
    "provider": "opencli",
    "group": "shopping",
    "site": "jd",
    "command": "detail",
    "module": "jd/detail.js",
    "description": "京东商品详情",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "sku"
      ],
      "properties": {
        "sku": {
          "type": "string",
          "description": "商品 SKU ID",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "field",
      "value"
    ],
    "mapping": {
      "sku": "sku"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.spotify.search",
    "provider": "opencli",
    "group": "music",
    "site": "spotify",
    "command": "search",
    "module": "spotify/spotify.js",
    "description": "Search for tracks",
    "browser": false,
    "strategy": "public",
    "auth": "oauth",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of results (default: 10)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "track",
      "artist",
      "album",
      "uri"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit"
    },
    "defaults": {
      "limit": 10
    },
    "idTypes": {}
  },
  {
    "id": "opencli.spotify.status",
    "provider": "opencli",
    "group": "music",
    "site": "spotify",
    "command": "status",
    "module": "spotify/spotify.js",
    "description": "Show current playback status",
    "browser": false,
    "strategy": "public",
    "auth": "oauth",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {}
    },
    "columns": [
      "track",
      "artist",
      "album",
      "status",
      "progress"
    ],
    "mapping": {},
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.spotify.play",
    "provider": "opencli",
    "group": "music",
    "site": "spotify",
    "command": "play",
    "module": "spotify/spotify.js",
    "description": "Resume playback or search and play a track/artist",
    "browser": false,
    "strategy": "public",
    "auth": "oauth",
    "readOnly": false,
    "refreshable": false,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "query": {
          "type": "string",
          "description": "Track or artist to play (optional)",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "track",
      "artist",
      "status"
    ],
    "mapping": {
      "query": "query"
    },
    "defaults": {
      "query": ""
    },
    "idTypes": {}
  },
  {
    "id": "opencli.spotify.pause",
    "provider": "opencli",
    "group": "music",
    "site": "spotify",
    "command": "pause",
    "module": "spotify/spotify.js",
    "description": "Pause playback",
    "browser": false,
    "strategy": "public",
    "auth": "oauth",
    "readOnly": false,
    "refreshable": false,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {}
    },
    "columns": [
      "status"
    ],
    "mapping": {},
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.spotify.next",
    "provider": "opencli",
    "group": "music",
    "site": "spotify",
    "command": "next",
    "module": "spotify/spotify.js",
    "description": "Skip to next track",
    "browser": false,
    "strategy": "public",
    "auth": "oauth",
    "readOnly": false,
    "refreshable": false,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {}
    },
    "columns": [
      "status"
    ],
    "mapping": {},
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.spotify.prev",
    "provider": "opencli",
    "group": "music",
    "site": "spotify",
    "command": "prev",
    "module": "spotify/spotify.js",
    "description": "Skip to previous track",
    "browser": false,
    "strategy": "public",
    "auth": "oauth",
    "readOnly": false,
    "refreshable": false,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {}
    },
    "columns": [
      "status"
    ],
    "mapping": {},
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.spotify.volume",
    "provider": "opencli",
    "group": "music",
    "site": "spotify",
    "command": "volume",
    "module": "spotify/spotify.js",
    "description": "Set playback volume (0-100)",
    "browser": false,
    "strategy": "public",
    "auth": "oauth",
    "readOnly": false,
    "refreshable": false,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "level"
      ],
      "properties": {
        "level": {
          "type": "integer",
          "description": "Volume 0–100",
          "minimum": 0,
          "maximum": 100
        }
      }
    },
    "columns": [
      "volume"
    ],
    "mapping": {
      "level": "level"
    },
    "defaults": {
      "level": 50
    },
    "idTypes": {}
  },
  {
    "id": "opencli.spotify.queue",
    "provider": "opencli",
    "group": "music",
    "site": "spotify",
    "command": "queue",
    "module": "spotify/spotify.js",
    "description": "Add a track to the playback queue",
    "browser": false,
    "strategy": "public",
    "auth": "oauth",
    "readOnly": false,
    "refreshable": false,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Track to add to queue",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "track",
      "artist",
      "status"
    ],
    "mapping": {
      "query": "query"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.spotify.repeat",
    "provider": "opencli",
    "group": "music",
    "site": "spotify",
    "command": "repeat",
    "module": "spotify/spotify.js",
    "description": "Set repeat mode (off / track / context)",
    "browser": false,
    "strategy": "public",
    "auth": "oauth",
    "readOnly": false,
    "refreshable": false,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "mode": {
          "type": "string",
          "description": "off / track / context",
          "maxLength": 300,
          "enum": [
            "off",
            "track",
            "context"
          ]
        }
      }
    },
    "columns": [
      "repeat"
    ],
    "mapping": {
      "mode": "mode"
    },
    "defaults": {
      "mode": "context"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.spotify.shuffle",
    "provider": "opencli",
    "group": "music",
    "site": "spotify",
    "command": "shuffle",
    "module": "spotify/spotify.js",
    "description": "Toggle shuffle on/off",
    "browser": false,
    "strategy": "public",
    "auth": "oauth",
    "readOnly": false,
    "refreshable": false,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "state": {
          "type": "string",
          "description": "on or off",
          "maxLength": 300,
          "enum": [
            "on",
            "off"
          ]
        }
      }
    },
    "columns": [
      "shuffle"
    ],
    "mapping": {
      "state": "state"
    },
    "defaults": {
      "state": "on"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.yollomi.remove-bg",
    "provider": "opencli",
    "group": "images",
    "site": "yollomi",
    "command": "remove-bg",
    "module": "yollomi/remove-bg.js",
    "description": "Remove image background with AI (free)",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": false,
    "refreshable": false,
    "timeoutMs": 120000,
    "inputSchema": {
      "type": "object",
      "required": [
        "image"
      ],
      "properties": {
        "image": {
          "type": "string",
          "description": "Image URL to remove background from",
          "maxLength": 2000,
          "minLength": 1
        }
      }
    },
    "columns": [
      "status",
      "file",
      "size",
      "url"
    ],
    "mapping": {
      "image": "image"
    },
    "defaults": {
      "no-download": true
    },
    "idTypes": {}
  },
  {
    "id": "opencli.yollomi.restore",
    "provider": "opencli",
    "group": "images",
    "site": "yollomi",
    "command": "restore",
    "module": "yollomi/restore.js",
    "description": "Restore old or damaged photos with AI (4 credits)",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": false,
    "refreshable": false,
    "timeoutMs": 120000,
    "inputSchema": {
      "type": "object",
      "required": [
        "image"
      ],
      "properties": {
        "image": {
          "type": "string",
          "description": "Image URL to restore",
          "maxLength": 2000,
          "minLength": 1
        }
      }
    },
    "columns": [
      "status",
      "file",
      "size",
      "url"
    ],
    "mapping": {
      "image": "image"
    },
    "defaults": {
      "no-download": true
    },
    "idTypes": {}
  },
  {
    "id": "opencli.yollomi.upscale",
    "provider": "opencli",
    "group": "images",
    "site": "yollomi",
    "command": "upscale",
    "module": "yollomi/upscale.js",
    "description": "Upscale image resolution with AI (1 credit)",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": false,
    "refreshable": false,
    "timeoutMs": 120000,
    "inputSchema": {
      "type": "object",
      "required": [
        "image"
      ],
      "properties": {
        "image": {
          "type": "string",
          "description": "Image URL to upscale",
          "maxLength": 2000,
          "minLength": 1
        },
        "scale": {
          "type": "string",
          "description": "Upscale factor (2 or 4)",
          "maxLength": 300,
          "enum": [
            "2",
            "4"
          ]
        }
      }
    },
    "columns": [
      "status",
      "file",
      "size",
      "scale",
      "url"
    ],
    "mapping": {
      "image": "image",
      "scale": "scale"
    },
    "defaults": {
      "scale": "2",
      "no-download": true
    },
    "idTypes": {}
  },
  {
    "id": "opencli.yollomi.background",
    "provider": "opencli",
    "group": "images",
    "site": "yollomi",
    "command": "background",
    "module": "yollomi/background.js",
    "description": "Generate AI background for a product/object image (5 credits)",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": false,
    "refreshable": false,
    "timeoutMs": 120000,
    "inputSchema": {
      "type": "object",
      "required": [
        "image"
      ],
      "properties": {
        "image": {
          "type": "string",
          "description": "Image URL (upload via \"opencli yollomi upload\" first)",
          "maxLength": 2000,
          "minLength": 1
        },
        "prompt": {
          "type": "string",
          "description": "Background description (optional)",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "status",
      "file",
      "size",
      "url"
    ],
    "mapping": {
      "image": "image",
      "prompt": "prompt"
    },
    "defaults": {
      "prompt": "",
      "no-download": true
    },
    "idTypes": {}
  },
  {
    "id": "opencli.ctrip.search",
    "provider": "opencli",
    "group": "travel",
    "site": "ctrip",
    "command": "search",
    "module": "ctrip/search.js",
    "description": "搜索携程目的地、景区、火车站和地标联想结果",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search keyword (city, scenic spot, landmark)",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of results (1-50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "type",
      "displayType",
      "name",
      "eName",
      "cityId",
      "cityName",
      "provinceName",
      "countryName",
      "lat",
      "lon",
      "score",
      "url"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit"
    },
    "defaults": {
      "limit": 15
    },
    "idTypes": {}
  },
  {
    "id": "opencli.ctrip.hotel-search",
    "provider": "opencli",
    "group": "travel",
    "site": "ctrip",
    "command": "hotel-search",
    "module": "ctrip/hotel-search.js",
    "description": "搜索携程酒店列表（按城市 + 入住/离店日期）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "city",
        "checkin",
        "checkout"
      ],
      "properties": {
        "city": {
          "type": "string",
          "description": "Numeric Ctrip city ID (use `ctrip search` or `ctrip hotel-suggest` to discover)",
          "maxLength": 300,
          "minLength": 1
        },
        "checkin": {
          "type": "string",
          "description": "Check-in date (YYYY-MM-DD)",
          "maxLength": 300,
          "minLength": 1
        },
        "checkout": {
          "type": "string",
          "description": "Check-out date (YYYY-MM-DD)",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of hotels (1-30); SSR first page returns ~13 entries",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "hotelId",
      "name",
      "enName",
      "star",
      "score",
      "scoreLabel",
      "reviewCount",
      "cityName",
      "district",
      "address",
      "lat",
      "lon",
      "price",
      "currency",
      "url"
    ],
    "mapping": {
      "city": "city",
      "checkin": "checkin",
      "checkout": "checkout",
      "limit": "limit"
    },
    "defaults": {
      "limit": 10
    },
    "idTypes": {}
  },
  {
    "id": "opencli.ctrip.hotel",
    "provider": "opencli",
    "group": "travel",
    "site": "ctrip",
    "command": "hotel",
    "module": "ctrip/hotel.js",
    "description": "查看携程单个酒店详情（评分细分、热门设施、入离政策、位置）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": "string",
          "description": "Numeric Ctrip hotel id (use `ctrip hotel-suggest` to discover; e.g. 375539)",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "hotelId",
      "name",
      "enName",
      "star",
      "score",
      "scoreLabel",
      "reviewCount",
      "ratingBreakdown",
      "facilities",
      "checkInOut",
      "cityName",
      "address",
      "lat",
      "lon",
      "url"
    ],
    "mapping": {
      "id": "id"
    },
    "defaults": {},
    "unsupportedReason": "OpenCLI 1.8.6 不提供此命令；保留旧卡片声明，但不能执行。"
  },
  {
    "id": "opencli.ctrip.flight",
    "provider": "opencli",
    "group": "travel",
    "site": "ctrip",
    "command": "flight",
    "module": "ctrip/flight.js",
    "description": "搜索携程一程机票（按出发/到达 IATA 三字码 + 日期）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "from",
        "to",
        "date"
      ],
      "properties": {
        "from": {
          "type": "string",
          "description": "Departure IATA code (e.g. BJS / PEK)",
          "maxLength": 300,
          "minLength": 1
        },
        "to": {
          "type": "string",
          "description": "Arrival IATA code (e.g. SHA / PVG)",
          "maxLength": 300,
          "minLength": 1
        },
        "date": {
          "type": "string",
          "description": "Departure date (YYYY-MM-DD)",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of flights (1-50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "airline",
      "flightNo",
      "aircraft",
      "departureTime",
      "departureAirport",
      "arrivalTime",
      "arrivalAirport",
      "terminal",
      "price",
      "currency",
      "cabin",
      "url"
    ],
    "mapping": {
      "from": "from",
      "to": "to",
      "date": "date",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.ctrip.attraction",
    "provider": "opencli",
    "group": "travel",
    "site": "ctrip",
    "command": "attraction",
    "module": "ctrip/attraction.js",
    "description": "列出携程某城市的热门景点（评分/点评数，城市 id 经 ctrip search 获取）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "city"
      ],
      "properties": {
        "city": {
          "type": "string",
          "description": "Numeric Ctrip city id (from `ctrip search`, e.g. 1 for 北京)",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of attractions (1-50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "name",
      "rating",
      "reviews",
      "url"
    ],
    "mapping": {
      "city": "city",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "unsupportedReason": "OpenCLI 1.8.6 不提供此命令；保留旧卡片声明，但不能执行。"
  },
  {
    "id": "opencli.ctrip.hotel-suggest",
    "provider": "opencli",
    "group": "travel",
    "site": "ctrip",
    "command": "hotel-suggest",
    "module": "ctrip/hotel-suggest.js",
    "description": "搜索携程酒店上下文联想：城市、商圈、单酒店匹配",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search keyword (city, business area, or hotel name)",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of results (1-50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "type",
      "displayType",
      "name",
      "eName",
      "cityId",
      "cityName",
      "provinceName",
      "countryName",
      "lat",
      "lon",
      "score",
      "url"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit"
    },
    "defaults": {
      "limit": 15
    },
    "idTypes": {}
  },
  {
    "id": "opencli.dianping.search",
    "provider": "opencli",
    "group": "dining",
    "site": "dianping",
    "command": "search",
    "module": "dianping/search.js",
    "description": "大众点评店铺搜索（按关键词 + 城市）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "keyword"
      ],
      "properties": {
        "keyword": {
          "type": "string",
          "description": "搜索关键词，例如 \"火锅\"",
          "maxLength": 300,
          "minLength": 1
        },
        "city": {
          "type": "string",
          "description": "城市名（北京/上海/汕头/beijing/shantou/...）或 cityId 数字。未在静态表中的城市会通过 dianping.com 在线解析。不传则使用 cookie 默认城市",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "返回的店铺数量（最多 15，dianping 单页固定 15 条）",
          "minimum": 1,
          "maximum": 15
        }
      }
    },
    "columns": [
      "rank",
      "shop_id",
      "name",
      "rating",
      "reviews",
      "price",
      "cuisine",
      "district",
      "url"
    ],
    "mapping": {
      "keyword": "keyword",
      "city": "city",
      "limit": "limit"
    },
    "defaults": {
      "limit": 15
    },
    "idTypes": {}
  },
  {
    "id": "opencli.dianping.shop",
    "provider": "opencli",
    "group": "dining",
    "site": "dianping",
    "command": "shop",
    "module": "dianping/shop.js",
    "description": "大众点评店铺详情（按 shop_id）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "shop_id"
      ],
      "properties": {
        "shop_id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "店铺 ID（来自 search 的 shop_id 列，或 https://www.dianping.com/shop/<id> URL 段）",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "field",
      "value"
    ],
    "mapping": {
      "shop_id": "shop_id"
    },
    "defaults": {},
    "idTypes": {
      "shop_id": "string"
    }
  },
  {
    "id": "opencli.bilibili.search",
    "provider": "opencli",
    "group": "learning",
    "site": "bilibili",
    "command": "search",
    "module": "bilibili/search.js",
    "description": "Search Bilibili videos or users",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search keyword",
          "maxLength": 300,
          "minLength": 1
        },
        "type": {
          "type": "string",
          "description": "video or user",
          "maxLength": 300
        },
        "page": {
          "type": "integer",
          "description": "Result page",
          "minimum": 1,
          "maximum": 20
        },
        "limit": {
          "type": "integer",
          "description": "Number of results",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "author",
      "score",
      "url"
    ],
    "mapping": {
      "query": "query",
      "type": "type",
      "page": "page",
      "limit": "limit"
    },
    "defaults": {
      "type": "video",
      "page": 1,
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.bilibili.subtitle",
    "provider": "opencli",
    "group": "learning",
    "site": "bilibili",
    "command": "subtitle",
    "module": "bilibili/subtitle.js",
    "description": "获取 Bilibili 视频的字幕",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "bvid"
      ],
      "properties": {
        "bvid": {
          "type": "string",
          "description": "Bilibili 视频 BV ID（如 BV1xx411c7mD），或视频 URL / b23.tv 短链",
          "maxLength": 2000,
          "minLength": 1
        },
        "lang": {
          "type": "string",
          "description": "字幕语言代码 (如 zh-CN, en-US, ai-zh)，默认取第一个",
          "maxLength": 300
        },
        "page": {
          "type": "string",
          "description": "分P 选集序号（从 1 开始）。多 P 视频取该集字幕；缺省取默认 P1",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "index",
      "from",
      "to",
      "content"
    ],
    "mapping": {
      "bvid": "bvid",
      "lang": "lang",
      "page": "page"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.bilibili.summary",
    "provider": "opencli",
    "group": "learning",
    "site": "bilibili",
    "command": "summary",
    "module": "bilibili/summary.js",
    "description": "获取 B站视频的官方 AI 总结（视频页「AI总结」同款，含分段大纲与时间戳）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "bvid"
      ],
      "properties": {
        "bvid": {
          "type": "string",
          "description": "Video BV ID / URL / b23.tv short link",
          "maxLength": 2000,
          "minLength": 1
        }
      }
    },
    "columns": [
      "time",
      "content"
    ],
    "mapping": {
      "bvid": "bvid"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.bilibili.hot",
    "provider": "opencli",
    "group": "learning",
    "site": "bilibili",
    "command": "hot",
    "module": "bilibili/hot.js",
    "description": "B站热门视频",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of videos",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "author",
      "play",
      "danmaku",
      "bvid",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.bilibili.ranking",
    "provider": "opencli",
    "group": "learning",
    "site": "bilibili",
    "command": "ranking",
    "module": "bilibili/ranking.js",
    "description": "Get Bilibili video ranking board",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "author",
      "score",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.bilibili.video",
    "provider": "opencli",
    "group": "learning",
    "site": "bilibili",
    "command": "video",
    "module": "bilibili/video.js",
    "description": "Get Bilibili video metadata (title, author, duration, stats, etc.)",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "bvid"
      ],
      "properties": {
        "bvid": {
          "type": "string",
          "description": "BV ID, video URL, or b23.tv short link",
          "maxLength": 2000,
          "minLength": 1
        },
        "page": {
          "type": "string",
          "description": "分P 选集序号（从 1 开始）。多 P 视频指定某一集，title/cid 返回该集；缺省取整集默认（P1）",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "field",
      "value"
    ],
    "mapping": {
      "bvid": "bvid",
      "page": "page"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.bilibili.comments",
    "provider": "opencli",
    "group": "learning",
    "site": "bilibili",
    "command": "comments",
    "module": "bilibili/comments.js",
    "description": "获取 B站视频评论（官方 API；用 --parent <rpid> 读取某条评论下的「楼中楼」回复）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "bvid"
      ],
      "properties": {
        "bvid": {
          "type": "string",
          "description": "Video BV ID (e.g. BV1WtAGzYEBm)",
          "maxLength": 2000,
          "minLength": 1
        },
        "parent": {
          "type": "integer",
          "description": "rpid of a comment — fetch the replies under it instead of top-level comments",
          "minimum": 0,
          "maximum": 2147483647
        },
        "limit": {
          "type": "integer",
          "description": "Number of comments (max 50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "rpid",
      "author",
      "text",
      "likes",
      "replies",
      "time"
    ],
    "mapping": {
      "bvid": "bvid",
      "parent": "parent",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.bilibili.user-videos",
    "provider": "opencli",
    "group": "learning",
    "site": "bilibili",
    "command": "user-videos",
    "module": "bilibili/user-videos.js",
    "description": "查看指定用户的投稿视频",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "uid"
      ],
      "properties": {
        "uid": {
          "type": [
            "string",
            "integer"
          ],
          "description": "User UID or username",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of results",
          "minimum": 1,
          "maximum": 20
        },
        "order": {
          "type": "string",
          "description": "Sort: pubdate, click, stow",
          "maxLength": 300
        },
        "page": {
          "type": "integer",
          "description": "Page number",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "plays",
      "likes",
      "date",
      "url"
    ],
    "mapping": {
      "uid": "uid",
      "limit": "limit",
      "order": "order",
      "page": "page"
    },
    "defaults": {
      "limit": 20,
      "order": "pubdate",
      "page": 1
    },
    "idTypes": {
      "uid": "string"
    }
  },
  {
    "id": "opencli.bilibili.following",
    "provider": "opencli",
    "group": "learning",
    "site": "bilibili",
    "command": "following",
    "module": "bilibili/following.js",
    "description": "获取 Bilibili 用户的关注列表",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "uid": {
          "type": [
            "string",
            "integer"
          ],
          "description": "目标用户 ID（默认为当前登录用户）",
          "maxLength": 128,
          "minLength": 1
        },
        "page": {
          "type": "integer",
          "description": "页码",
          "minimum": 1,
          "maximum": 20
        },
        "limit": {
          "type": "integer",
          "description": "每页数量 (最大 50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "mid",
      "name",
      "sign",
      "following",
      "fans"
    ],
    "mapping": {
      "uid": "uid",
      "page": "page",
      "limit": "limit"
    },
    "defaults": {
      "page": 1,
      "limit": 20
    },
    "idTypes": {
      "uid": "string"
    }
  },
  {
    "id": "opencli.bilibili.history",
    "provider": "opencli",
    "group": "learning",
    "site": "bilibili",
    "command": "history",
    "module": "bilibili/history.js",
    "description": "我的观看历史",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of results",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "author",
      "progress",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.bilibili.feed",
    "provider": "opencli",
    "group": "learning",
    "site": "bilibili",
    "command": "feed",
    "module": "bilibili/feed.js",
    "description": "动态时间线（不传 uid 查关注时间线，传 uid 查指定用户动态）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "uid": {
          "type": [
            "string",
            "integer"
          ],
          "description": "用户 UID 或用户名（不传则显示关注时间线）",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max results to return",
          "minimum": 1,
          "maximum": 20
        },
        "type": {
          "type": "string",
          "description": "Filter: all, video, article, draw, text",
          "maxLength": 300
        },
        "pages": {
          "type": "integer",
          "description": "Number of pages to fetch (each ~20 items)",
          "minimum": 0,
          "maximum": 2147483647
        }
      }
    },
    "columns": [
      "rank",
      "time",
      "author",
      "title",
      "type",
      "likes",
      "url"
    ],
    "mapping": {
      "uid": "uid",
      "limit": "limit",
      "type": "type",
      "pages": "pages"
    },
    "defaults": {
      "limit": 20,
      "type": "all",
      "pages": 1
    },
    "idTypes": {
      "uid": "string"
    }
  },
  {
    "id": "opencli.bilibili.feed-detail",
    "provider": "opencli",
    "group": "learning",
    "site": "bilibili",
    "command": "feed-detail",
    "module": "bilibili/feed.js",
    "description": "查看 Bilibili 动态详情（支持充电专属内容）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "动态 ID（从 feed 命令的 url 中获取）",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "field",
      "value"
    ],
    "mapping": {
      "id": "id"
    },
    "defaults": {},
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.bilibili.dynamic",
    "provider": "opencli",
    "group": "learning",
    "site": "bilibili",
    "command": "dynamic",
    "module": "bilibili/dynamic.js",
    "description": "Get Bilibili user dynamic feed",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "id",
      "author",
      "text",
      "likes",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 15
    },
    "idTypes": {}
  },
  {
    "id": "opencli.mubu.search",
    "provider": "opencli",
    "group": "notes",
    "site": "mubu",
    "command": "search",
    "module": "mubu/search.js",
    "description": "全局搜索幕布文档和文件夹（标题+内容，服务端全量匹配）。结果含 type/id/name/path/hits/snippet 字段。",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "搜索关键词",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "最多显示条数（默认 100，结果被截断时用 --limit N 调大）",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "type",
      "id",
      "name",
      "path",
      "hits",
      "snippet"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.mubu.doc",
    "provider": "opencli",
    "group": "notes",
    "site": "mubu",
    "command": "doc",
    "module": "mubu/doc.js",
    "description": "读取幕布文档内容（默认输出 Markdown，可用 --output text 输出纯文本）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "文档 ID",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "content"
    ],
    "mapping": {
      "id": "id"
    },
    "defaults": {
      "output": "text"
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.mubu.docs",
    "provider": "opencli",
    "group": "notes",
    "site": "mubu",
    "command": "docs",
    "module": "mubu/docs.js",
    "description": "列出幕布文档（默认根目录，--starred 查看快速访问列表）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "folder": {
          "type": "string",
          "description": "文件夹 ID（默认根目录 0）",
          "maxLength": 300
        },
        "starred": {
          "type": "boolean",
          "description": "只显示快速访问的文档和文件夹"
        },
        "limit": {
          "type": "integer",
          "description": "最多显示条数",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "type",
      "id",
      "name",
      "updated",
      "stared"
    ],
    "mapping": {
      "folder": "folder",
      "starred": "starred",
      "limit": "limit"
    },
    "defaults": {
      "folder": "0",
      "starred": false,
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.mubu.recent",
    "provider": "opencli",
    "group": "notes",
    "site": "mubu",
    "command": "recent",
    "module": "mubu/recent.js",
    "description": "最近编辑的幕布文档",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "最多显示条数",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "id",
      "name",
      "updated"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.mubu.notes",
    "provider": "opencli",
    "group": "notes",
    "site": "mubu",
    "command": "notes",
    "module": "mubu/notes.js",
    "description": "读取幕布速记（默认今天）。支持 --date/--month/--year/--from/--to 指定时间范围，--list 为概览模式（日期+条数）。",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "list": {
          "type": "boolean",
          "description": "概览模式：只输出日期和条数，不含速记内容。可与任意时间范围参数组合。"
        },
        "date": {
          "type": "string",
          "description": "单日，格式 YYYY-MM-DD。不指定时间范围则默认今天（系统本地时间）。",
          "maxLength": 300
        },
        "month": {
          "type": "string",
          "description": "整月，格式 YYYY-MM。",
          "maxLength": 300
        },
        "year": {
          "type": "integer",
          "description": "整年，格式 YYYY（整数）。",
          "minimum": 0,
          "maximum": 2147483647
        },
        "from": {
          "type": "string",
          "description": "范围起始日，格式 YYYY-MM-DD。须与 --to 同时使用。",
          "maxLength": 300
        },
        "to": {
          "type": "string",
          "description": "范围截止日，格式 YYYY-MM-DD。须与 --from 同时使用。",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "date",
      "content"
    ],
    "mapping": {
      "list": "list",
      "date": "date",
      "month": "month",
      "year": "year",
      "from": "from",
      "to": "to"
    },
    "defaults": {
      "list": false
    },
    "idTypes": {}
  },
  {
    "id": "opencli.xiaohongshu.search",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "search",
    "module": "xiaohongshu/search.js",
    "description": "搜索小红书笔记",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search keyword",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of results",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "author",
      "likes",
      "published_at",
      "url"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.xiaohongshu.note",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "note",
    "module": "xiaohongshu/note.js",
    "description": "获取小红书笔记正文和互动数据",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "noteId"
      ],
      "properties": {
        "noteId": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Full Xiaohongshu note URL with xsec_token",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "field",
      "value"
    ],
    "mapping": {
      "noteId": "note-id"
    },
    "defaults": {},
    "idTypes": {
      "noteId": "string"
    }
  },
  {
    "id": "opencli.xiaohongshu.drafts",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "drafts",
    "module": "xiaohongshu/drafts.js",
    "description": "小红书本地草稿箱列表",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "type": {
          "type": "string",
          "description": "Draft type: image, video, article, audio",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "type",
      "title",
      "updated_at",
      "images",
      "text_preview"
    ],
    "mapping": {
      "type": "type"
    },
    "defaults": {
      "type": "image"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.xiaohongshu.feed",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "feed",
    "module": "xiaohongshu/feed.js",
    "description": "小红书首页推荐 Feed (reads hydrated Pinia store)",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of items to return",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "id",
      "title",
      "author",
      "likes",
      "type",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.xiaohongshu.comments",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "comments",
    "module": "xiaohongshu/comments.js",
    "description": "获取小红书笔记评论（支持楼中楼子回复）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "noteId"
      ],
      "properties": {
        "noteId": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Full Xiaohongshu note URL with xsec_token",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of top-level comments (max 50)",
          "minimum": 1,
          "maximum": 20
        },
        "withReplies": {
          "type": "boolean",
          "description": "Include nested replies (楼中楼)"
        }
      }
    },
    "columns": [
      "rank",
      "author",
      "userId",
      "profileUrl",
      "text",
      "likes",
      "time",
      "is_reply",
      "reply_to"
    ],
    "mapping": {
      "noteId": "note-id",
      "limit": "limit",
      "withReplies": "with-replies"
    },
    "defaults": {
      "limit": 20,
      "with-replies": false
    },
    "idTypes": {
      "noteId": "string"
    }
  },
  {
    "id": "opencli.xiaohongshu.user",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "user",
    "module": "xiaohongshu/user.js",
    "description": "Get public notes from a Xiaohongshu user profile",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "User id or profile URL",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of notes to return",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "id",
      "title",
      "type",
      "likes",
      "url"
    ],
    "mapping": {
      "id": "id",
      "limit": "limit"
    },
    "defaults": {
      "limit": 15
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.xiaohongshu.saved",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "saved",
    "module": "xiaohongshu/saved.js",
    "description": "小红书收藏笔记列表",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "User id or profile URL (defaults to current logged-in user)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of notes to return",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "author",
      "likes",
      "type",
      "url"
    ],
    "mapping": {
      "id": "id",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.xiaohongshu.liked",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "liked",
    "module": "xiaohongshu/liked.js",
    "description": "小红书赞过笔记列表",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "User id or profile URL (defaults to current logged-in user)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of notes to return",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "author",
      "likes",
      "type",
      "url"
    ],
    "mapping": {
      "id": "id",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.xiaohongshu.notifications",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "notifications",
    "module": "xiaohongshu/notifications.js",
    "description": "小红书通知 (mentions/likes/connections)",
    "browser": true,
    "strategy": "intercept",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "type": {
          "type": "string",
          "description": "Notification type: mentions, likes, or connections",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "Number of notifications to return",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "user",
      "action",
      "content",
      "note",
      "time"
    ],
    "mapping": {
      "type": "type",
      "limit": "limit"
    },
    "defaults": {
      "type": "mentions",
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.xiaohongshu.creator-profile",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "creator-profile",
    "module": "xiaohongshu/creator-profile.js",
    "description": "小红书创作者账号信息 (粉丝/关注/获赞/成长等级)",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {}
    },
    "columns": [
      "field",
      "value"
    ],
    "mapping": {},
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.xiaohongshu.creator-stats",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "creator-stats",
    "module": "xiaohongshu/creator-stats.js",
    "description": "小红书创作者数据总览 (观看/点赞/收藏/评论/分享/涨粉，含每日趋势)",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "period": {
          "type": "string",
          "description": "Stats period: seven or thirty",
          "maxLength": 300,
          "enum": [
            "seven",
            "thirty"
          ]
        }
      }
    },
    "columns": [
      "metric",
      "total",
      "trend"
    ],
    "mapping": {
      "period": "period"
    },
    "defaults": {
      "period": "seven"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.xiaohongshu.creator-notes",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "creator-notes",
    "module": "xiaohongshu/creator-notes-summary.js",
    "description": "小红书创作者笔记列表 + 每篇数据 (标题/日期/观看/点赞/收藏/评论)",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of notes to return",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "date",
      "views",
      "likes",
      "collects",
      "comments",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.xiaohongshu.creator-note-detail",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "creator-note-detail",
    "module": "xiaohongshu/creator-note-detail.js",
    "description": "小红书单篇笔记详情页数据 (笔记信息 + 核心/互动数据 + 观看来源 + 观众画像 + 趋势数据)",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "noteId"
      ],
      "properties": {
        "noteId": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Note ID (from creator-notes or note-detail page URL)",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "section",
      "metric",
      "value",
      "extra"
    ],
    "mapping": {
      "noteId": "note-id"
    },
    "defaults": {},
    "idTypes": {
      "noteId": "string"
    }
  },
  {
    "id": "opencli.xiaohongshu.creator-notes-summary",
    "provider": "opencli",
    "group": "social",
    "site": "xiaohongshu",
    "command": "creator-notes-summary",
    "module": "xiaohongshu/creator-notes-summary.js",
    "description": "小红书最近笔记批量摘要 (列表 + 单篇关键数据汇总)",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of recent notes to summarize",
          "minimum": 1,
          "maximum": 20
        },
        "timeout": {
          "type": "integer",
          "description": "Max seconds for the overall command (default: 180)",
          "minimum": 0,
          "maximum": 2147483647
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "views",
      "likes",
      "collects",
      "comments",
      "shares",
      "avg_view_time",
      "rise_fans",
      "top_source",
      "top_interest",
      "url"
    ],
    "mapping": {
      "limit": "limit",
      "timeout": "timeout"
    },
    "defaults": {
      "limit": 3,
      "timeout": 180
    },
    "idTypes": {}
  },
  {
    "id": "opencli.zhihu.hot",
    "provider": "opencli",
    "group": "learning",
    "site": "zhihu",
    "command": "hot",
    "module": "zhihu/hot.js",
    "description": "知乎热榜",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of items to return",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "heat",
      "answers"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.zhihu.search",
    "provider": "opencli",
    "group": "learning",
    "site": "zhihu",
    "command": "search",
    "module": "zhihu/search.js",
    "description": "知乎搜索",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of results (max 1000; use normal-sized requests)",
          "minimum": 1,
          "maximum": 20
        },
        "type": {
          "type": "string",
          "description": "Result type: all, answer, article, or question",
          "maxLength": 300,
          "enum": [
            "all",
            "answer",
            "article",
            "question"
          ]
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "type",
      "author",
      "votes",
      "url"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit",
      "type": "type"
    },
    "defaults": {
      "limit": 10,
      "type": "all"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.zhihu.question",
    "provider": "opencli",
    "group": "learning",
    "site": "zhihu",
    "command": "question",
    "module": "zhihu/question.js",
    "description": "知乎问题详情和回答",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Question ID (numeric)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of answers (max 1000; use normal-sized requests)",
          "minimum": 1,
          "maximum": 20
        },
        "sort": {
          "type": "string",
          "description": "Answer order: default or created",
          "maxLength": 300,
          "enum": [
            "default",
            "created"
          ]
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "author",
      "votes",
      "url",
      "content"
    ],
    "mapping": {
      "id": "id",
      "limit": "limit",
      "sort": "sort"
    },
    "defaults": {
      "limit": 5,
      "sort": "default"
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.zhihu.answer-detail",
    "provider": "opencli",
    "group": "learning",
    "site": "zhihu",
    "command": "answer-detail",
    "module": "zhihu/answer-detail.js",
    "description": "知乎单个回答完整内容（按 answer ID 获取）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Answer ID, full Zhihu answer URL, or typed target (answer:<qid>:<aid>)",
          "maxLength": 128,
          "minLength": 1
        },
        "maxContent": {
          "type": "integer",
          "description": "Optional cap on stripped content length in characters (0 = no truncation, return the full answer)",
          "minimum": 0,
          "maximum": 2147483647
        }
      }
    },
    "columns": [
      "id",
      "author",
      "votes",
      "comments",
      "question_id",
      "question_title",
      "url",
      "created_at",
      "updated_at",
      "content"
    ],
    "mapping": {
      "id": "id",
      "maxContent": "max-content"
    },
    "defaults": {
      "max-content": 0
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.zhihu.answer-comments",
    "provider": "opencli",
    "group": "learning",
    "site": "zhihu",
    "command": "answer-comments",
    "module": "zhihu/answer-comments.js",
    "description": "知乎回答评论列表",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Answer ID, full Zhihu answer URL, or typed target (answer:<qid>:<aid>)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of top-level comments (max 1000)",
          "minimum": 1,
          "maximum": 20
        },
        "repliesLimit": {
          "type": "integer",
          "description": "Number of replies to include per top-level comment (max 100)",
          "minimum": 0,
          "maximum": 2147483647
        }
      }
    },
    "columns": [
      "rank",
      "comment_rank",
      "reply_rank",
      "depth",
      "id",
      "parent_id",
      "author",
      "reply_to",
      "likes",
      "created_at",
      "url",
      "content"
    ],
    "mapping": {
      "id": "id",
      "limit": "limit",
      "repliesLimit": "replies-limit"
    },
    "defaults": {
      "limit": 20,
      "replies-limit": 3
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.zhihu.user",
    "provider": "opencli",
    "group": "learning",
    "site": "zhihu",
    "command": "user",
    "module": "zhihu/user.js",
    "description": "知乎用户主页资料（粉丝/关注/回答/文章/获赞数）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "user"
      ],
      "properties": {
        "user": {
          "type": "string",
          "description": "User url_token or people URL, e.g. wen-jie-16-47",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "url_token",
      "name",
      "headline",
      "followers",
      "following",
      "answers",
      "articles",
      "voteup",
      "url"
    ],
    "mapping": {
      "user": "user"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.zhihu.user-answers",
    "provider": "opencli",
    "group": "learning",
    "site": "zhihu",
    "command": "user-answers",
    "module": "zhihu/user-answers.js",
    "description": "知乎某用户的回答列表",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "user"
      ],
      "properties": {
        "user": {
          "type": "string",
          "description": "User url_token or people URL",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of answers to return (max 1000)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "question",
      "votes",
      "comments",
      "created",
      "url"
    ],
    "mapping": {
      "user": "user",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.zhihu.user-articles",
    "provider": "opencli",
    "group": "learning",
    "site": "zhihu",
    "command": "user-articles",
    "module": "zhihu/user-articles.js",
    "description": "知乎某用户的文章/专栏列表",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "user"
      ],
      "properties": {
        "user": {
          "type": "string",
          "description": "User url_token or people URL",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of articles to return (max 1000)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "votes",
      "comments",
      "created",
      "url"
    ],
    "mapping": {
      "user": "user",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.zhihu.collections",
    "provider": "opencli",
    "group": "learning",
    "site": "zhihu",
    "command": "collections",
    "module": "zhihu/collections.js",
    "description": "知乎收藏夹列表（需要登录）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "每页数量（最大 20）",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "item_count",
      "description",
      "collection_id"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.zhihu.collection",
    "provider": "opencli",
    "group": "learning",
    "site": "zhihu",
    "command": "collection",
    "module": "zhihu/collection.js",
    "description": "知乎收藏夹内容列表（需要登录）",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "收藏夹 ID (数字，可从收藏夹 URL 中获取)",
          "maxLength": 128,
          "minLength": 1
        },
        "offset": {
          "type": "integer",
          "description": "起始偏移量（用于分页）",
          "minimum": 0,
          "maximum": 200
        },
        "limit": {
          "type": "integer",
          "description": "每页数量（最大 20）",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "type",
      "title",
      "author",
      "votes",
      "excerpt",
      "url"
    ],
    "mapping": {
      "id": "id",
      "offset": "offset",
      "limit": "limit"
    },
    "defaults": {
      "offset": 0,
      "limit": 20
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.zhihu.recommend",
    "provider": "opencli",
    "group": "learning",
    "site": "zhihu",
    "command": "recommend",
    "module": "zhihu/recommend.js",
    "description": "知乎首页推荐",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of items to return (max 1000; use normal-sized requests)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "type",
      "title",
      "author",
      "votes",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.weibo.hot",
    "provider": "opencli",
    "group": "social",
    "site": "weibo",
    "command": "hot",
    "module": "weibo/hot.js",
    "description": "微博热搜",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of items (max 50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "word",
      "hot_value",
      "category",
      "label",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.weibo.search",
    "provider": "opencli",
    "group": "social",
    "site": "weibo",
    "command": "search",
    "module": "weibo/search.js",
    "description": "搜索微博",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "keyword"
      ],
      "properties": {
        "keyword": {
          "type": "string",
          "description": "Search keyword",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of results (max 50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "author",
      "time",
      "url"
    ],
    "mapping": {
      "keyword": "keyword",
      "limit": "limit"
    },
    "defaults": {
      "limit": 10
    },
    "idTypes": {}
  },
  {
    "id": "opencli.weibo.post",
    "provider": "opencli",
    "group": "social",
    "site": "weibo",
    "command": "post",
    "module": "weibo/post.js",
    "description": "Get a single Weibo post",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Post ID (numeric idstr or mblogid from URL)",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "field",
      "value"
    ],
    "mapping": {
      "id": "id"
    },
    "defaults": {},
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.weibo.comments",
    "provider": "opencli",
    "group": "social",
    "site": "weibo",
    "command": "comments",
    "module": "weibo/comments.js",
    "description": "Get comments on a Weibo post",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Post ID (numeric idstr)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of comments (max 50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "author",
      "text",
      "likes",
      "replies",
      "time"
    ],
    "mapping": {
      "id": "id",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.weibo.user",
    "provider": "opencli",
    "group": "social",
    "site": "weibo",
    "command": "user",
    "module": "weibo/user.js",
    "description": "Get Weibo user profile",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "User ID (numeric uid) or screen name",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "screen_name",
      "uid",
      "followers",
      "following",
      "statuses",
      "verified",
      "description",
      "location",
      "url"
    ],
    "mapping": {
      "id": "id"
    },
    "defaults": {},
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.weibo.user-posts",
    "provider": "opencli",
    "group": "social",
    "site": "weibo",
    "command": "user-posts",
    "module": "weibo/user-posts.js",
    "description": "List Weibo posts from a user, optionally filtered by date range",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "User ID (numeric uid) or screen name",
          "maxLength": 128,
          "minLength": 1
        },
        "start": {
          "type": "string",
          "description": "Start date in Asia/Shanghai (YYYY-MM-DD)",
          "maxLength": 300
        },
        "end": {
          "type": "string",
          "description": "End date in Asia/Shanghai (YYYY-MM-DD)",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "Number of posts (1-100)",
          "minimum": 1,
          "maximum": 20
        },
        "includeRetweets": {
          "type": "boolean",
          "description": "Include retweets"
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "mblogid",
      "author",
      "uid",
      "text",
      "time",
      "reposts",
      "comments",
      "likes",
      "pic_count",
      "url"
    ],
    "mapping": {
      "id": "id",
      "start": "start",
      "end": "end",
      "limit": "limit",
      "includeRetweets": "include-retweets"
    },
    "defaults": {
      "limit": 20,
      "include-retweets": false
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.weibo.feed",
    "provider": "opencli",
    "group": "social",
    "site": "weibo",
    "command": "feed",
    "module": "weibo/feed.js",
    "description": "Fetch Weibo timeline (for-you or following)",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "type": {
          "type": "string",
          "description": "Timeline type: for-you (algorithmic) or following (chronological)",
          "maxLength": 300,
          "enum": [
            "for-you",
            "following"
          ]
        },
        "limit": {
          "type": "integer",
          "description": "Number of posts (max 50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "id",
      "author",
      "text",
      "reposts",
      "comments",
      "likes",
      "time",
      "url"
    ],
    "mapping": {
      "type": "type",
      "limit": "limit"
    },
    "defaults": {
      "type": "for-you",
      "limit": 15
    },
    "idTypes": {}
  },
  {
    "id": "opencli.weibo.favorites",
    "provider": "opencli",
    "group": "social",
    "site": "weibo",
    "command": "favorites",
    "module": "weibo/favorites.js",
    "description": "我的微博收藏列表",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "数量（最多50）",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "author",
      "text",
      "time",
      "source",
      "likes",
      "comments",
      "reposts",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.youtube.search",
    "provider": "opencli",
    "group": "learning",
    "site": "youtube",
    "command": "search",
    "module": "youtube/search.js",
    "description": "Search YouTube videos",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max results (max 50)",
          "minimum": 1,
          "maximum": 20
        },
        "type": {
          "type": "string",
          "description": "Filter type: shorts, video, channel, playlist",
          "maxLength": 300
        },
        "upload": {
          "type": "string",
          "description": "Upload date: hour, today, week, month, year",
          "maxLength": 300
        },
        "sort": {
          "type": "string",
          "description": "Sort by: relevance, date, views, rating",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "channel",
      "views",
      "duration",
      "published",
      "url"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit",
      "type": "type",
      "upload": "upload",
      "sort": "sort"
    },
    "defaults": {
      "limit": 20,
      "type": "",
      "upload": "",
      "sort": ""
    },
    "idTypes": {}
  },
  {
    "id": "opencli.youtube.video",
    "provider": "opencli",
    "group": "learning",
    "site": "youtube",
    "command": "video",
    "module": "youtube/video.js",
    "description": "Get YouTube video metadata (title, views, description, etc.)",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "url"
      ],
      "properties": {
        "url": {
          "type": "string",
          "description": "YouTube video URL or video ID",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "field",
      "value"
    ],
    "mapping": {
      "url": "url"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.youtube.channel",
    "provider": "opencli",
    "group": "learning",
    "site": "youtube",
    "command": "channel",
    "module": "youtube/channel.js",
    "description": "Get YouTube channel info and recent videos",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Channel ID (UCxxxx) or handle (@name)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max recent videos (max 30)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "field",
      "value"
    ],
    "mapping": {
      "id": "id",
      "limit": "limit"
    },
    "defaults": {
      "limit": 10
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.youtube.playlist",
    "provider": "opencli",
    "group": "learning",
    "site": "youtube",
    "command": "playlist",
    "module": "youtube/playlist.js",
    "description": "Get YouTube playlist info and video list",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Playlist URL or playlist ID (PLxxxxxx)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max videos to return (default 50, max 200)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "channel",
      "duration",
      "views",
      "published",
      "url"
    ],
    "mapping": {
      "id": "id",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.youtube.comments",
    "provider": "opencli",
    "group": "learning",
    "site": "youtube",
    "command": "comments",
    "module": "youtube/comments.js",
    "description": "Get YouTube video comments",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "url"
      ],
      "properties": {
        "url": {
          "type": "string",
          "description": "YouTube video URL or video ID",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max comments (max 100)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "author",
      "text",
      "likes",
      "replies",
      "time"
    ],
    "mapping": {
      "url": "url",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.youtube.transcript",
    "provider": "opencli",
    "group": "learning",
    "site": "youtube",
    "command": "transcript",
    "module": "youtube/transcript.js",
    "description": "Get YouTube video transcript/subtitles",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "url"
      ],
      "properties": {
        "url": {
          "type": "string",
          "description": "YouTube video URL or video ID",
          "maxLength": 300,
          "minLength": 1
        },
        "lang": {
          "type": "string",
          "description": "Language code (e.g. en, zh-Hans). Omit to auto-select",
          "maxLength": 300
        },
        "mode": {
          "type": "string",
          "description": "Output mode: grouped (readable paragraphs) or raw (every segment)",
          "maxLength": 300
        }
      }
    },
    "columns": [],
    "mapping": {
      "url": "url",
      "lang": "lang",
      "mode": "mode"
    },
    "defaults": {
      "mode": "grouped"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.youtube.subscriptions",
    "provider": "opencli",
    "group": "learning",
    "site": "youtube",
    "command": "subscriptions",
    "module": "youtube/subscriptions.js",
    "description": "List subscribed YouTube channels",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Max channels to return (default 50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "name",
      "handle",
      "subscribers",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.youtube.watch-later",
    "provider": "opencli",
    "group": "learning",
    "site": "youtube",
    "command": "watch-later",
    "module": "youtube/watch-later.js",
    "description": "Get your YouTube Watch Later queue",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Max videos to return (default 50, max 200)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "channel",
      "duration",
      "views",
      "published",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.flomo.memos",
    "provider": "opencli",
    "group": "notes",
    "site": "flomo",
    "command": "memos",
    "module": "flomo/memos.js",
    "description": "List your Flomo memos",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of memos to fetch (1-200)",
          "minimum": 1,
          "maximum": 20
        },
        "since": {
          "type": "integer",
          "description": "Only memos updated after this Unix timestamp in seconds",
          "minimum": 0,
          "maximum": 2147483647
        },
        "slug": {
          "type": "string",
          "description": "Pagination cursor from a previous memo page",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "id",
      "url",
      "content",
      "slug",
      "tags",
      "images",
      "created_at",
      "updated_at"
    ],
    "mapping": {
      "limit": "limit",
      "since": "since",
      "slug": "slug"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.smzdm.search",
    "provider": "opencli",
    "group": "shopping",
    "site": "smzdm",
    "command": "search",
    "module": "smzdm/search.js",
    "description": "什么值得买搜索好价",
    "browser": true,
    "strategy": "cookie",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search keyword",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of results",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "price",
      "mall",
      "updated_at",
      "zhi_count",
      "buzhi_count",
      "favorite_count",
      "comments",
      "url"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.apple-podcasts.search",
    "provider": "opencli",
    "group": "podcasts",
    "site": "apple-podcasts",
    "command": "search",
    "module": "apple-podcasts/search.js",
    "description": "Search Apple Podcasts",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search keyword",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max results",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "id",
      "title",
      "author",
      "episodes",
      "genre",
      "url"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit"
    },
    "defaults": {
      "limit": 10
    },
    "idTypes": {}
  },
  {
    "id": "opencli.apple-podcasts.top",
    "provider": "opencli",
    "group": "podcasts",
    "site": "apple-podcasts",
    "command": "top",
    "module": "apple-podcasts/top.js",
    "description": "Top podcasts chart on Apple Podcasts",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of podcasts (max 100)",
          "minimum": 1,
          "maximum": 20
        },
        "country": {
          "type": "string",
          "description": "Country code (e.g. us, cn, gb, jp)",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "author",
      "id"
    ],
    "mapping": {
      "limit": "limit",
      "country": "country"
    },
    "defaults": {
      "limit": 20,
      "country": "us"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.apple-podcasts.episodes",
    "provider": "opencli",
    "group": "podcasts",
    "site": "apple-podcasts",
    "command": "episodes",
    "module": "apple-podcasts/episodes.js",
    "description": "List recent episodes of an Apple Podcast (use ID from search)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Podcast ID (collectionId from search output)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max episodes to show",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "title",
      "duration",
      "date"
    ],
    "mapping": {
      "id": "id",
      "limit": "limit"
    },
    "defaults": {
      "limit": 15
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.xiaoyuzhou.episode",
    "provider": "opencli",
    "group": "podcasts",
    "site": "xiaoyuzhou",
    "command": "episode",
    "module": "xiaoyuzhou/episode.js",
    "description": "View details of a Xiaoyuzhou podcast episode",
    "browser": false,
    "strategy": "local",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Episode ID (eid from podcast-episodes output)",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "title",
      "podcast",
      "duration",
      "plays",
      "comments",
      "likes",
      "date"
    ],
    "mapping": {
      "id": "id"
    },
    "defaults": {},
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.xiaoyuzhou.podcast",
    "provider": "opencli",
    "group": "podcasts",
    "site": "xiaoyuzhou",
    "command": "podcast",
    "module": "xiaoyuzhou/podcast.js",
    "description": "View a Xiaoyuzhou podcast profile",
    "browser": false,
    "strategy": "local",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Podcast ID (from xiaoyuzhoufm.com URL)",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "title",
      "author",
      "description",
      "subscribers",
      "episodes",
      "updated"
    ],
    "mapping": {
      "id": "id"
    },
    "defaults": {},
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.xiaoyuzhou.podcast-episodes",
    "provider": "opencli",
    "group": "podcasts",
    "site": "xiaoyuzhou",
    "command": "podcast-episodes",
    "module": "xiaoyuzhou/podcast-episodes.js",
    "description": "List episodes of a Xiaoyuzhou podcast",
    "browser": false,
    "strategy": "local",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Podcast ID (from xiaoyuzhoufm.com URL)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max episodes to show",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "eid",
      "title",
      "duration",
      "plays",
      "date"
    ],
    "mapping": {
      "id": "id",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.wikipedia.search",
    "provider": "opencli",
    "group": "knowledge",
    "site": "wikipedia",
    "command": "search",
    "module": "wikipedia/search.js",
    "description": "Search Wikipedia articles",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search keyword",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max results",
          "minimum": 1,
          "maximum": 20
        },
        "lang": {
          "type": "string",
          "description": "Language code (e.g. en, zh, ja)",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "title",
      "snippet",
      "url"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit",
      "lang": "lang"
    },
    "defaults": {
      "limit": 10,
      "lang": "en"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.wikipedia.summary",
    "provider": "opencli",
    "group": "knowledge",
    "site": "wikipedia",
    "command": "summary",
    "module": "wikipedia/summary.js",
    "description": "Get Wikipedia article summary",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "title"
      ],
      "properties": {
        "title": {
          "type": "string",
          "description": "Article title (e.g. \"Transformer (machine learning model)\")",
          "maxLength": 300,
          "minLength": 1
        },
        "lang": {
          "type": "string",
          "description": "Language code (e.g. en, zh, ja)",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "title",
      "description",
      "extract",
      "url"
    ],
    "mapping": {
      "title": "title",
      "lang": "lang"
    },
    "defaults": {
      "lang": "en"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.wikipedia.page",
    "provider": "opencli",
    "group": "knowledge",
    "site": "wikipedia",
    "command": "page",
    "module": "wikipedia/page.js",
    "description": "Full plain-text extract of a Wikipedia article (optional paragraph cap).",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "title"
      ],
      "properties": {
        "title": {
          "type": "string",
          "description": "Article title (e.g. \"Transformer (machine learning model)\")",
          "maxLength": 300,
          "minLength": 1
        },
        "lang": {
          "type": "string",
          "description": "Language code (en, zh, ja, de, ...).",
          "maxLength": 300
        },
        "paragraphs": {
          "type": "integer",
          "description": "Cap to first N paragraphs (0 = full article).",
          "minimum": 0,
          "maximum": 20
        }
      }
    },
    "columns": [
      "title",
      "description",
      "pageId",
      "paragraphs",
      "extract",
      "url"
    ],
    "mapping": {
      "title": "title",
      "lang": "lang",
      "paragraphs": "paragraphs"
    },
    "defaults": {
      "lang": "en",
      "paragraphs": 0
    },
    "idTypes": {}
  },
  {
    "id": "opencli.wikipedia.trending",
    "provider": "opencli",
    "group": "knowledge",
    "site": "wikipedia",
    "command": "trending",
    "module": "wikipedia/trending.js",
    "description": "Most-read Wikipedia articles (yesterday)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Max results",
          "minimum": 1,
          "maximum": 20
        },
        "lang": {
          "type": "string",
          "description": "Language code (e.g. en, zh, ja)",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "description",
      "views"
    ],
    "mapping": {
      "limit": "limit",
      "lang": "lang"
    },
    "defaults": {
      "limit": 10,
      "lang": "en"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.wikipedia.random",
    "provider": "opencli",
    "group": "knowledge",
    "site": "wikipedia",
    "command": "random",
    "module": "wikipedia/random.js",
    "description": "Get a random Wikipedia article",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "lang": {
          "type": "string",
          "description": "Language code (e.g. en, zh, ja)",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "title",
      "description",
      "extract",
      "url"
    ],
    "mapping": {
      "lang": "lang"
    },
    "defaults": {
      "lang": "en"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.wikidata.search",
    "provider": "opencli",
    "group": "knowledge",
    "site": "wikidata",
    "command": "search",
    "module": "wikidata/search.js",
    "description": "Search Wikidata items by keyword (returns Q-IDs)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search keyword (label / alias)",
          "maxLength": 300,
          "minLength": 1
        },
        "language": {
          "type": "string",
          "description": "Search & display language (ISO 639, e.g. en, fr, zh)",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "Max items (1-50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "qid",
      "label",
      "description",
      "matchType",
      "matchText",
      "url"
    ],
    "mapping": {
      "query": "query",
      "language": "language",
      "limit": "limit"
    },
    "defaults": {
      "language": "en",
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.wikidata.entity",
    "provider": "opencli",
    "group": "knowledge",
    "site": "wikidata",
    "command": "entity",
    "module": "wikidata/entity.js",
    "description": "Fetch a Wikidata entity by Q/P/L id (label, description, aliases, claim summary)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Entity id (e.g. Q937 = Albert Einstein, P31 = instance of)",
          "maxLength": 128,
          "minLength": 1
        },
        "language": {
          "type": "string",
          "description": "Display language (ISO 639, falls back to English when missing)",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "qid",
      "type",
      "label",
      "description",
      "aliases",
      "claimPropertyCount",
      "sitelinkCount",
      "enwikiTitle",
      "modified",
      "url"
    ],
    "mapping": {
      "id": "id",
      "language": "language"
    },
    "defaults": {
      "language": "en"
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.dictionary.search",
    "provider": "opencli",
    "group": "language",
    "site": "dictionary",
    "command": "search",
    "module": "dictionary/search.js",
    "description": "Search the Free Dictionary API for definitions, parts of speech, and pronunciations.",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "word"
      ],
      "properties": {
        "word": {
          "type": "string",
          "description": "Word to define (e.g., serendipity)",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "word",
      "phonetic",
      "type",
      "definition"
    ],
    "mapping": {
      "word": "word"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.dictionary.examples",
    "provider": "opencli",
    "group": "language",
    "site": "dictionary",
    "command": "examples",
    "module": "dictionary/examples.js",
    "description": "Read real-world example sentences utilizing the word",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "word"
      ],
      "properties": {
        "word": {
          "type": "string",
          "description": "Word to get example sentences for",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "word",
      "example"
    ],
    "mapping": {
      "word": "word"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.dictionary.synonyms",
    "provider": "opencli",
    "group": "language",
    "site": "dictionary",
    "command": "synonyms",
    "module": "dictionary/synonyms.js",
    "description": "Find synonyms for a specific word",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "word"
      ],
      "properties": {
        "word": {
          "type": "string",
          "description": "Word to find synonyms for (e.g., serendipity)",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "word",
      "synonyms"
    ],
    "mapping": {
      "word": "word"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.rest-countries.country",
    "provider": "opencli",
    "group": "travel",
    "site": "rest-countries",
    "command": "country",
    "module": "rest-countries/country.js",
    "description": "Look up countries by name (common / official, substring match)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "name"
      ],
      "properties": {
        "name": {
          "type": "string",
          "description": "Country name (e.g. \"japan\", \"united kingdom\")",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max rows (1-250)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "commonName",
      "officialName",
      "cca2",
      "cca3",
      "ccn3",
      "capital",
      "region",
      "subregion",
      "population",
      "area",
      "languages",
      "currencies",
      "latitude",
      "longitude",
      "timezones",
      "independent",
      "unMember",
      "landlocked",
      "flag",
      "url"
    ],
    "mapping": {
      "name": "name",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.rest-countries.region",
    "provider": "opencli",
    "group": "travel",
    "site": "rest-countries",
    "command": "region",
    "module": "rest-countries/region.js",
    "description": "List countries in a region (africa / americas / asia / europe / oceania / antarctic)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "region"
      ],
      "properties": {
        "region": {
          "type": "string",
          "description": "Region name (case-insensitive)",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max rows (1-250)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "commonName",
      "officialName",
      "cca2",
      "cca3",
      "ccn3",
      "capital",
      "region",
      "subregion",
      "population",
      "area",
      "languages",
      "currencies",
      "latitude",
      "longitude",
      "timezones",
      "independent",
      "unMember",
      "landlocked",
      "flag",
      "url"
    ],
    "mapping": {
      "region": "region",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.tvmaze.search",
    "provider": "opencli",
    "group": "movies",
    "site": "tvmaze",
    "command": "search",
    "module": "tvmaze/search.js",
    "description": "TVmaze TV show search by title (returns id, name, network, premiered/ended, rating)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "TV show title or fragment to search for",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max rows to return (1-50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "name",
      "type",
      "language",
      "genres",
      "status",
      "premiered",
      "ended",
      "network",
      "rating",
      "matchScore",
      "summary",
      "url"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.tvmaze.show",
    "provider": "opencli",
    "group": "movies",
    "site": "tvmaze",
    "command": "show",
    "module": "tvmaze/show.js",
    "description": "Single TVmaze TV show detail by id (network, schedule, rating, IMDB/TheTVDB cross-refs)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "TVmaze show id (positive integer)",
          "minimum": 0,
          "maximum": 2147483647,
          "minLength": 1,
          "maxLength": 128
        }
      }
    },
    "columns": [
      "id",
      "name",
      "type",
      "language",
      "genres",
      "status",
      "premiered",
      "ended",
      "runtime",
      "averageRuntime",
      "network",
      "country",
      "schedule",
      "rating",
      "imdb",
      "thetvdb",
      "officialSite",
      "summary",
      "url"
    ],
    "mapping": {
      "id": "id"
    },
    "defaults": {},
    "idTypes": {
      "id": "integer"
    }
  },
  {
    "id": "opencli.steam.search",
    "provider": "opencli",
    "group": "games",
    "site": "steam",
    "command": "search",
    "module": "steam/search.js",
    "description": "Search the Steam storefront by name keyword",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search keyword (e.g. \"portal\", \"stardew\")",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max results (1-50)",
          "minimum": 1,
          "maximum": 20
        },
        "currency": {
          "type": "string",
          "description": "Storefront country code (e.g. us / cn / jp / de)",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "name",
      "price",
      "currency",
      "metascore",
      "platforms",
      "url"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit",
      "currency": "currency"
    },
    "defaults": {
      "limit": 20,
      "currency": "us"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.steam.app",
    "provider": "opencli",
    "group": "games",
    "site": "steam",
    "command": "app",
    "module": "steam/app.js",
    "description": "Steam storefront detail for a single app id",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Numeric Steam app id (e.g. \"620\" for Portal 2)",
          "maxLength": 128,
          "minLength": 1
        },
        "currency": {
          "type": "string",
          "description": "Storefront country code (e.g. us / cn / jp / de)",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "id",
      "name",
      "type",
      "isFree",
      "releaseDate",
      "developers",
      "publishers",
      "price",
      "currency",
      "metacritic",
      "recommendations",
      "genres",
      "categories",
      "shortDescription",
      "website",
      "url"
    ],
    "mapping": {
      "id": "id",
      "currency": "currency"
    },
    "defaults": {
      "currency": "us"
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.steam.top-sellers",
    "provider": "opencli",
    "group": "games",
    "site": "steam",
    "command": "top-sellers",
    "module": "steam/top-sellers.js",
    "description": "Steam top selling games",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of games",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "name",
      "price",
      "discount",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 10
    },
    "idTypes": {}
  },
  {
    "id": "opencli.dongchedi.search",
    "provider": "opencli",
    "group": "cars",
    "site": "dongchedi",
    "command": "search",
    "module": "dongchedi/search.js",
    "description": "懂车帝车系搜索（按关键词，返回车系 + 指导价/经销商价）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "keyword"
      ],
      "properties": {
        "keyword": {
          "type": "string",
          "description": "搜索关键词，例如 \"宝马X5\" 或 \"汉兰达\"",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "返回的车系数量（最多 30）",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "series_id",
      "name",
      "brand",
      "official_price",
      "dealer_price",
      "pictures",
      "url"
    ],
    "mapping": {
      "keyword": "keyword",
      "limit": "limit"
    },
    "defaults": {
      "limit": 15
    },
    "idTypes": {}
  },
  {
    "id": "opencli.dongchedi.series",
    "provider": "opencli",
    "group": "cars",
    "site": "dongchedi",
    "command": "series",
    "module": "dongchedi/series.js",
    "description": "懂车帝车系概览（品牌 / 指导价 / 二手价 / 懂车分 / 销量排名 / 在售款型数）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "series_id"
      ],
      "properties": {
        "series_id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "车系 ID（来自 search 的 series_id，或 /auto/series/<id> URL）",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "field",
      "value"
    ],
    "mapping": {
      "series_id": "series_id"
    },
    "defaults": {},
    "idTypes": {
      "series_id": "string"
    }
  },
  {
    "id": "opencli.dongchedi.models",
    "provider": "opencli",
    "group": "cars",
    "site": "dongchedi",
    "command": "models",
    "module": "dongchedi/models.js",
    "description": "懂车帝车系款型列表（car_id / 名称 / 年款 / 指导价 / 经销商价 / 车主成交价）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "series_id"
      ],
      "properties": {
        "series_id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "车系 ID（来自 search 的 series_id，或 /auto/series/<id> URL）",
          "maxLength": 128,
          "minLength": 1
        },
        "status": {
          "type": "string",
          "description": "在售 online（默认）或停售 offline",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "car_id",
      "name",
      "year",
      "official_price",
      "dealer_price",
      "owner_price"
    ],
    "mapping": {
      "series_id": "series_id",
      "status": "status"
    },
    "defaults": {
      "status": "online"
    },
    "idTypes": {
      "series_id": "string"
    }
  },
  {
    "id": "opencli.dongchedi.specs",
    "provider": "opencli",
    "group": "cars",
    "site": "dongchedi",
    "command": "specs",
    "module": "dongchedi/specs.js",
    "description": "懂车帝车系配置概览（尺寸 / 动力 / 发动机 / 变速箱 / 四驱 / 悬挂 / 气囊）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "series_id"
      ],
      "properties": {
        "series_id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "车系 ID（来自 search 的 series_id，或 /auto/series/<id> URL）",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "field",
      "value"
    ],
    "mapping": {
      "series_id": "series_id"
    },
    "defaults": {},
    "idTypes": {
      "series_id": "string"
    }
  },
  {
    "id": "opencli.dongchedi.score",
    "provider": "opencli",
    "group": "cars",
    "site": "dongchedi",
    "command": "score",
    "module": "dongchedi/score.js",
    "description": "懂车帝车系评分（懂车分 8 维度 + 同级车均值对比）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "series_id"
      ],
      "properties": {
        "series_id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "车系 ID（来自 search 的 series_id，或 /auto/series/<id> URL）",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "dimension",
      "score",
      "same_level_avg"
    ],
    "mapping": {
      "series_id": "series_id"
    },
    "defaults": {},
    "idTypes": {
      "series_id": "string"
    }
  },
  {
    "id": "opencli.dongchedi.koubei",
    "provider": "opencli",
    "group": "cars",
    "site": "dongchedi",
    "command": "koubei",
    "module": "dongchedi/koubei.js",
    "description": "懂车帝车系口碑/车主评价（评分 / 购车款型 / 点赞 / 评论 / 正文摘要）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "series_id"
      ],
      "properties": {
        "series_id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "车系 ID（来自 search 的 series_id，或 /auto/series/<id> URL）",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "返回的口碑条数（最多 15，单页 SSR 上限）",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "user",
      "car",
      "score",
      "likes",
      "comments",
      "content",
      "url"
    ],
    "mapping": {
      "series_id": "series_id",
      "limit": "limit"
    },
    "defaults": {
      "limit": 10
    },
    "idTypes": {
      "series_id": "string"
    }
  },
  {
    "id": "opencli.autohome.brand",
    "provider": "opencli",
    "group": "cars",
    "site": "autohome",
    "command": "brand",
    "module": "autohome/brand.js",
    "description": "汽车之家按品牌列出全部车系 + 厂商指导价（免登录）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "brand"
      ],
      "properties": {
        "brand": {
          "type": "string",
          "description": "品牌名（宝马 / 比亚迪 / 理想 / 丰田 …）或车系目录首字母 A-Z",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "返回的车系数量（最多 120）",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "series_id",
      "name",
      "price",
      "url"
    ],
    "mapping": {
      "brand": "brand",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.autohome.score",
    "provider": "opencli",
    "group": "cars",
    "site": "autohome",
    "command": "score",
    "module": "autohome/score.js",
    "description": "汽车之家车系口碑评分（总分 + 各维度 + 故障率PPH + 竞品对比，免登录）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "series_id"
      ],
      "properties": {
        "series_id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "车系 ID（来自 brand 的 series_id，或 k.autohome.com.cn/<id> URL）",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "field",
      "value"
    ],
    "mapping": {
      "series_id": "series_id"
    },
    "defaults": {},
    "idTypes": {
      "series_id": "string"
    }
  },
  {
    "id": "opencli.guazi.browse",
    "provider": "opencli",
    "group": "cars",
    "site": "guazi",
    "command": "browse",
    "module": "guazi/browse.js",
    "description": "瓜子二手车在售车源列表（按城市，含售价/首付/里程/年份）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "city": {
          "type": "string",
          "description": "城市名（北京/上海/...）或瓜子城市码（bj/sh/...）。默认 bj 北京",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "返回的车源数量（最多 40，单页 SSR 上限）",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "clue_id",
      "title",
      "price",
      "down_payment",
      "mileage",
      "year",
      "city",
      "url"
    ],
    "mapping": {
      "city": "city",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.guazi.car",
    "provider": "opencli",
    "group": "cars",
    "site": "guazi",
    "command": "car",
    "module": "guazi/car.js",
    "description": "瓜子二手车车源详情（售价 / 上牌 / 里程 / 过户 / 配置 / 车况）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "clue_id"
      ],
      "properties": {
        "clue_id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "车源 ID（来自 browse 的 clue_id，或 /car-detail/c<id>.html URL）",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "field",
      "value"
    ],
    "mapping": {
      "clue_id": "clue_id"
    },
    "defaults": {},
    "idTypes": {
      "clue_id": "string"
    }
  },
  {
    "id": "opencli.google.news",
    "provider": "opencli",
    "group": "search",
    "site": "google",
    "command": "news",
    "module": "google/news.js",
    "description": "Get Google News headlines",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "keyword": {
          "type": "string",
          "description": "Search query (omit for top stories)",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "Number of results",
          "minimum": 1,
          "maximum": 20
        },
        "lang": {
          "type": "string",
          "description": "Language short code (e.g. en, zh)",
          "maxLength": 300
        },
        "region": {
          "type": "string",
          "description": "Region code (e.g. US, CN)",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "title",
      "source",
      "date",
      "url"
    ],
    "mapping": {
      "keyword": "keyword",
      "limit": "limit",
      "lang": "lang",
      "region": "region"
    },
    "defaults": {
      "limit": 10,
      "lang": "en",
      "region": "US"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.google.suggest",
    "provider": "opencli",
    "group": "search",
    "site": "google",
    "command": "suggest",
    "module": "google/suggest.js",
    "description": "Get Google search suggestions",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "keyword"
      ],
      "properties": {
        "keyword": {
          "type": "string",
          "description": "Search query",
          "maxLength": 300,
          "minLength": 1
        },
        "lang": {
          "type": "string",
          "description": "Language code",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "suggestion"
    ],
    "mapping": {
      "keyword": "keyword",
      "lang": "lang"
    },
    "defaults": {
      "lang": "zh-CN"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.google.trends",
    "provider": "opencli",
    "group": "search",
    "site": "google",
    "command": "trends",
    "module": "google/trends.js",
    "description": "Get Google Trends daily trending searches",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "region": {
          "type": "string",
          "description": "Region code (e.g. US, CN, JP)",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "Number of results",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "title",
      "traffic",
      "date"
    ],
    "mapping": {
      "region": "region",
      "limit": "limit"
    },
    "defaults": {
      "region": "US",
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.google.search",
    "provider": "opencli",
    "group": "search",
    "site": "google",
    "command": "search",
    "module": "google/search.js",
    "description": "Search Google",
    "browser": true,
    "strategy": "public",
    "auth": "browser-session",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "keyword"
      ],
      "properties": {
        "keyword": {
          "type": "string",
          "description": "Search query",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of results (1-100)",
          "minimum": 1,
          "maximum": 20
        },
        "lang": {
          "type": "string",
          "description": "Language short code (e.g. en, zh)",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "type",
      "title",
      "url",
      "snippet"
    ],
    "mapping": {
      "keyword": "keyword",
      "limit": "limit",
      "lang": "lang"
    },
    "defaults": {
      "limit": 10,
      "lang": "en"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.duckduckgo.suggest",
    "provider": "opencli",
    "group": "search",
    "site": "duckduckgo",
    "command": "suggest",
    "module": "duckduckgo/suggest.js",
    "description": "DuckDuckGo search suggestions",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "keyword"
      ],
      "properties": {
        "keyword": {
          "type": "string",
          "description": "Search query prefix",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max number of suggestions",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "phrase"
    ],
    "mapping": {
      "keyword": "keyword",
      "limit": "limit"
    },
    "defaults": {
      "limit": 8
    },
    "idTypes": {}
  },
  {
    "id": "opencli.bbc.news",
    "provider": "opencli",
    "group": "news",
    "site": "bbc",
    "command": "news",
    "module": "bbc/news.js",
    "description": "BBC News headlines (RSS)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of headlines (max 50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "description",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.bbc.topic",
    "provider": "opencli",
    "group": "news",
    "site": "bbc",
    "command": "topic",
    "module": "bbc/topic.js",
    "description": "BBC News headlines for a specific section (RSS feed)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "topic"
      ],
      "properties": {
        "topic": {
          "type": "string",
          "description": "Section name (world / business / politics / health / education / science_and_environment / technology / entertainment_and_arts)",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max headlines (1-50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "description",
      "pubDate",
      "url"
    ],
    "mapping": {
      "topic": "topic",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.toutiao.hot",
    "provider": "opencli",
    "group": "news",
    "site": "toutiao",
    "command": "hot",
    "module": "toutiao/hot.js",
    "description": "今日头条首页热榜（公开 API，无需登录）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "返回条数 (1-50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "group_id",
      "title",
      "query",
      "hot_value",
      "label",
      "url",
      "image_url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.36kr.news",
    "provider": "opencli",
    "group": "news",
    "site": "36kr",
    "command": "news",
    "module": "36kr/news.js",
    "description": "Latest tech/startup news from 36kr (36氪)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of articles (max 50)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "summary",
      "date",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.hackernews.top",
    "provider": "opencli",
    "group": "news",
    "site": "hackernews",
    "command": "top",
    "module": "hackernews/top.js",
    "description": "Hacker News top stories",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of stories",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "score",
      "author",
      "comments",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.hackernews.best",
    "provider": "opencli",
    "group": "news",
    "site": "hackernews",
    "command": "best",
    "module": "hackernews/best.js",
    "description": "Hacker News best stories",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of stories",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "score",
      "author",
      "comments",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.hackernews.new",
    "provider": "opencli",
    "group": "news",
    "site": "hackernews",
    "command": "new",
    "module": "hackernews/new.js",
    "description": "Hacker News newest stories",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of stories",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "score",
      "author",
      "comments",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.hackernews.ask",
    "provider": "opencli",
    "group": "news",
    "site": "hackernews",
    "command": "ask",
    "module": "hackernews/ask.js",
    "description": "Hacker News Ask HN posts",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of stories",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "score",
      "author",
      "comments",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.hackernews.show",
    "provider": "opencli",
    "group": "news",
    "site": "hackernews",
    "command": "show",
    "module": "hackernews/show.js",
    "description": "Hacker News Show HN posts",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of stories",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "score",
      "author",
      "comments",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.hackernews.read",
    "provider": "opencli",
    "group": "news",
    "site": "hackernews",
    "command": "read",
    "module": "hackernews/read.js",
    "description": "Read a Hacker News story and its comment tree",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "HN item ID (e.g. 39847301)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max top-level comments",
          "minimum": 1,
          "maximum": 20
        },
        "depth": {
          "type": "integer",
          "description": "Max reply depth (1=no replies, 2=one level of replies, etc.)",
          "minimum": 1,
          "maximum": 4
        },
        "replies": {
          "type": "integer",
          "description": "Max replies shown per comment at each level",
          "minimum": 0,
          "maximum": 2147483647
        },
        "maxLength": {
          "type": "integer",
          "description": "Max characters per comment body (min 100)",
          "minimum": 0,
          "maximum": 2147483647
        }
      }
    },
    "columns": [
      "type",
      "author",
      "score",
      "text"
    ],
    "mapping": {
      "id": "id",
      "limit": "limit",
      "depth": "depth",
      "replies": "replies",
      "maxLength": "max-length"
    },
    "defaults": {
      "limit": 20,
      "depth": 2,
      "replies": 5,
      "max-length": 2000
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.hackernews.search",
    "provider": "opencli",
    "group": "news",
    "site": "hackernews",
    "command": "search",
    "module": "hackernews/search.js",
    "description": "Search Hacker News stories",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of results",
          "minimum": 1,
          "maximum": 20
        },
        "sort": {
          "type": "string",
          "description": "Sort by relevance or date",
          "maxLength": 300,
          "enum": [
            "relevance",
            "date"
          ]
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "score",
      "author",
      "comments",
      "url"
    ],
    "mapping": {
      "query": "query",
      "limit": "limit",
      "sort": "sort"
    },
    "defaults": {
      "limit": 20,
      "sort": "relevance"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.devto.top",
    "provider": "opencli",
    "group": "news",
    "site": "devto",
    "command": "top",
    "module": "devto/top.js",
    "description": "Top DEV.to articles of the day",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of articles",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "author",
      "reactions",
      "comments",
      "reading_time",
      "published_at",
      "tags",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.devto.latest",
    "provider": "opencli",
    "group": "news",
    "site": "devto",
    "command": "latest",
    "module": "devto/latest.js",
    "description": "Newest dev.to articles (firehose, all tags)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Articles per page (1-100)",
          "minimum": 1,
          "maximum": 20
        },
        "page": {
          "type": "integer",
          "description": "Page number (1-based)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "author",
      "tags",
      "reactions",
      "comments",
      "published",
      "url"
    ],
    "mapping": {
      "limit": "limit",
      "page": "page"
    },
    "defaults": {
      "limit": 20,
      "page": 1
    },
    "idTypes": {}
  },
  {
    "id": "opencli.devto.read",
    "provider": "opencli",
    "group": "news",
    "site": "devto",
    "command": "read",
    "module": "devto/read.js",
    "description": "Read a DEV.to article body by id",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "DEV.to article id (numeric, e.g. 3605688)",
          "maxLength": 128,
          "minLength": 1
        },
        "maxLength": {
          "type": "integer",
          "description": "Max characters of body to return (min 100)",
          "minimum": 0,
          "maximum": 2147483647
        }
      }
    },
    "columns": [
      "id",
      "title",
      "author",
      "reactions",
      "reading_time",
      "tags",
      "published_at",
      "body",
      "url"
    ],
    "mapping": {
      "id": "id",
      "maxLength": "max-length"
    },
    "defaults": {
      "max-length": 20000
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.devto.tag",
    "provider": "opencli",
    "group": "news",
    "site": "devto",
    "command": "tag",
    "module": "devto/tag.js",
    "description": "Latest DEV.to articles for a specific tag",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "tag"
      ],
      "properties": {
        "tag": {
          "type": "string",
          "description": "Tag name (e.g. javascript, python, webdev)",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of articles",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "author",
      "reactions",
      "comments",
      "reading_time",
      "published_at",
      "tags",
      "url"
    ],
    "mapping": {
      "tag": "tag",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.lobsters.hot",
    "provider": "opencli",
    "group": "news",
    "site": "lobsters",
    "command": "hot",
    "module": "lobsters/hot.js",
    "description": "Lobste.rs hottest stories",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of stories",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "score",
      "author",
      "comments",
      "created_at",
      "tags",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.lobsters.newest",
    "provider": "opencli",
    "group": "news",
    "site": "lobsters",
    "command": "newest",
    "module": "lobsters/newest.js",
    "description": "Lobste.rs newest stories",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of stories",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "id",
      "title",
      "score",
      "author",
      "comments",
      "created_at",
      "tags",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.lobsters.read",
    "provider": "opencli",
    "group": "news",
    "site": "lobsters",
    "command": "read",
    "module": "lobsters/read.js",
    "description": "Read a Lobste.rs story and its comment tree",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Lobste.rs short_id (e.g. 6cmh6h)",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Max top-level comments",
          "minimum": 1,
          "maximum": 20
        },
        "depth": {
          "type": "integer",
          "description": "Max reply depth (1=no replies, 2=one level of replies, etc.)",
          "minimum": 1,
          "maximum": 4
        },
        "replies": {
          "type": "integer",
          "description": "Max replies shown per comment at each level",
          "minimum": 0,
          "maximum": 2147483647
        },
        "maxLength": {
          "type": "integer",
          "description": "Max characters per comment body (min 100)",
          "minimum": 0,
          "maximum": 2147483647
        }
      }
    },
    "columns": [
      "type",
      "author",
      "score",
      "text"
    ],
    "mapping": {
      "id": "id",
      "limit": "limit",
      "depth": "depth",
      "replies": "replies",
      "maxLength": "max-length"
    },
    "defaults": {
      "limit": 20,
      "depth": 2,
      "replies": 5,
      "max-length": 2000
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.v2ex.hot",
    "provider": "opencli",
    "group": "news",
    "site": "v2ex",
    "command": "hot",
    "module": "v2ex/hot.js",
    "description": "V2EX 热门话题",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of topics",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "id",
      "rank",
      "title",
      "node",
      "replies",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.v2ex.latest",
    "provider": "opencli",
    "group": "news",
    "site": "v2ex",
    "command": "latest",
    "module": "v2ex/latest.js",
    "description": "V2EX 最新话题",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of topics",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "id",
      "rank",
      "title",
      "node",
      "replies",
      "url"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.v2ex.topic",
    "provider": "opencli",
    "group": "news",
    "site": "v2ex",
    "command": "topic",
    "module": "v2ex/topic.js",
    "description": "V2EX 主题详情和回复",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Topic ID",
          "maxLength": 128,
          "minLength": 1
        }
      }
    },
    "columns": [
      "id",
      "title",
      "content",
      "member",
      "created",
      "node",
      "replies",
      "url"
    ],
    "mapping": {
      "id": "id"
    },
    "defaults": {},
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.v2ex.replies",
    "provider": "opencli",
    "group": "news",
    "site": "v2ex",
    "command": "replies",
    "module": "v2ex/replies.js",
    "description": "V2EX 主题回复列表",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": [
            "string",
            "integer"
          ],
          "description": "Topic ID",
          "maxLength": 128,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of replies",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "floor",
      "author",
      "content"
    ],
    "mapping": {
      "id": "id",
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {
      "id": "string"
    }
  },
  {
    "id": "opencli.v2ex.nodes",
    "provider": "opencli",
    "group": "news",
    "site": "v2ex",
    "command": "nodes",
    "module": "v2ex/nodes.js",
    "description": "V2EX 所有节点列表",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Number of nodes",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "name",
      "title",
      "topics",
      "stars"
    ],
    "mapping": {
      "limit": "limit"
    },
    "defaults": {
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.v2ex.node",
    "provider": "opencli",
    "group": "news",
    "site": "v2ex",
    "command": "node",
    "module": "v2ex/node.js",
    "description": "V2EX 节点话题列表",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "name"
      ],
      "properties": {
        "name": {
          "type": "string",
          "description": "Node name (e.g. python, javascript, apple)",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of topics (API returns max 20)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "title",
      "author",
      "replies",
      "url"
    ],
    "mapping": {
      "name": "name",
      "limit": "limit"
    },
    "defaults": {
      "limit": 10
    },
    "idTypes": {}
  },
  {
    "id": "opencli.archive.search",
    "provider": "opencli",
    "group": "knowledge",
    "site": "archive",
    "command": "search",
    "module": "archive/search.js",
    "description": "Search Internet Archive items across books, movies, audio, software, and web.",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string",
          "description": "Full-text query (matches title, description, creator, subject).",
          "maxLength": 300,
          "minLength": 1
        },
        "mediatype": {
          "type": "string",
          "description": "Restrict to mediatype: texts, movies, audio, software, image, web, data, collection",
          "maxLength": 300
        },
        "sort": {
          "type": "string",
          "description": "Sort key: downloads, date, addeddate, week, title",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "Max items (max 100; one API page).",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "identifier",
      "title",
      "creator",
      "date",
      "mediatype",
      "downloads",
      "url"
    ],
    "mapping": {
      "query": "query",
      "mediatype": "mediatype",
      "sort": "sort",
      "limit": "limit"
    },
    "defaults": {
      "sort": "downloads",
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.archive.item",
    "provider": "opencli",
    "group": "knowledge",
    "site": "archive",
    "command": "item",
    "module": "archive/item.js",
    "description": "Fetch metadata for a single Internet Archive item by identifier.",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "identifier"
      ],
      "properties": {
        "identifier": {
          "type": "string",
          "description": "Archive item identifier (e.g. \"open-syllabus\", \"FinalFantasy2_356\").",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "identifier",
      "title",
      "creator",
      "date",
      "mediatype",
      "collection",
      "description",
      "file_count",
      "url"
    ],
    "mapping": {
      "identifier": "identifier"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.chess.games",
    "provider": "opencli",
    "group": "games",
    "site": "chess",
    "command": "games",
    "module": "chess/games.js",
    "description": "Chess.com recent games for a player, newest first",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "username"
      ],
      "properties": {
        "username": {
          "type": "string",
          "description": "Chess.com username",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Number of recent games (1-100)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "date",
      "time_class",
      "rated",
      "my_color",
      "my_rating",
      "my_result",
      "opponent",
      "opponent_rating",
      "accuracy_white",
      "accuracy_black",
      "eco",
      "opening_name",
      "url"
    ],
    "mapping": {
      "username": "username",
      "limit": "limit"
    },
    "defaults": {
      "limit": 10
    },
    "idTypes": {}
  },
  {
    "id": "opencli.chess.stats",
    "provider": "opencli",
    "group": "games",
    "site": "chess",
    "command": "stats",
    "module": "chess/stats.js",
    "description": "Chess.com player ratings + win/loss record across game kinds",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "username"
      ],
      "properties": {
        "username": {
          "type": "string",
          "description": "Chess.com username (case-insensitive)",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "kind",
      "rating_current",
      "rating_best",
      "wins",
      "losses",
      "draws"
    ],
    "mapping": {
      "username": "username"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.lichess.top",
    "provider": "opencli",
    "group": "games",
    "site": "lichess",
    "command": "top",
    "module": "lichess/top.js",
    "description": "Top-N Lichess leaderboard for a perf type (bullet/blitz/rapid/classical/...)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "perf"
      ],
      "properties": {
        "perf": {
          "type": "string",
          "description": "Perf type (bullet, blitz, rapid, classical, ultraBullet, chess960, ...)",
          "maxLength": 300,
          "minLength": 1
        },
        "limit": {
          "type": "integer",
          "description": "Top-N rows (1-200)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "username",
      "id",
      "title",
      "rating",
      "progress",
      "patron",
      "url"
    ],
    "mapping": {
      "perf": "perf",
      "limit": "limit"
    },
    "defaults": {
      "limit": 10
    },
    "idTypes": {}
  },
  {
    "id": "opencli.lichess.user",
    "provider": "opencli",
    "group": "games",
    "site": "lichess",
    "command": "user",
    "module": "lichess/user.js",
    "description": "Fetch a Lichess player profile by username (rating, perfs, counts)",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "username"
      ],
      "properties": {
        "username": {
          "type": "string",
          "description": "Lichess username (case-insensitive)",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "username",
      "id",
      "title",
      "patron",
      "online",
      "tosViolation",
      "createdAt",
      "seenAt",
      "gamesAll",
      "gamesWin",
      "gamesLoss",
      "gamesDraw",
      "topPerfName",
      "topPerfRating",
      "topPerfGames",
      "fideRating",
      "country",
      "bio",
      "url"
    ],
    "mapping": {
      "username": "username"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.eastmoney.quote",
    "provider": "opencli",
    "group": "finance",
    "site": "eastmoney",
    "command": "quote",
    "module": "eastmoney/quote.js",
    "description": "个股实时行情（A股 / 港股 / 美股）— 来自 push2.eastmoney.com",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "symbols"
      ],
      "properties": {
        "symbols": {
          "type": "string",
          "description": "股票代码（可用逗号/空格分隔多个）",
          "maxLength": 300,
          "minLength": 1
        }
      }
    },
    "columns": [
      "code",
      "name",
      "market",
      "price",
      "changePercent",
      "change",
      "open",
      "high",
      "low",
      "prevClose",
      "volume",
      "turnover",
      "turnoverRate",
      "amplitude",
      "peDynamic",
      "priceBook",
      "marketCap",
      "floatMarketCap"
    ],
    "mapping": {
      "symbols": "symbols"
    },
    "defaults": {},
    "idTypes": {}
  },
  {
    "id": "opencli.eastmoney.rank",
    "provider": "opencli",
    "group": "finance",
    "site": "eastmoney",
    "command": "rank",
    "module": "eastmoney/rank.js",
    "description": "东财市场涨跌/成交排行（沪深/北证/创/科/港/美）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "market": {
          "type": "string",
          "description": "市场：hs-a / sh-a / sz-a / bj-a / cyb / kcb / hk / us",
          "maxLength": 300
        },
        "sort": {
          "type": "string",
          "description": "排序：change / drop / turnover / volume / amplitude / rate",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "返回数量 (max 100)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "code",
      "name",
      "price",
      "changePercent",
      "change",
      "turnover",
      "volume",
      "turnoverRate",
      "peDynamic",
      "marketCap"
    ],
    "mapping": {
      "market": "market",
      "sort": "sort",
      "limit": "limit"
    },
    "defaults": {
      "market": "hs-a",
      "sort": "change",
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.eastmoney.kline",
    "provider": "opencli",
    "group": "finance",
    "site": "eastmoney",
    "command": "kline",
    "module": "eastmoney/kline.js",
    "description": "K线历史数据（分/日/周/月/前复权/后复权）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "symbol"
      ],
      "properties": {
        "symbol": {
          "type": "string",
          "description": "股票代码（A/HK/US 均可）",
          "maxLength": 300,
          "minLength": 1
        },
        "period": {
          "type": "string",
          "description": "周期：1m/5m/15m/30m/60m/day/week/month",
          "maxLength": 300
        },
        "adjust": {
          "type": "string",
          "description": "复权：none / forward / backward",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "返回最近 N 根（末尾）",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "date",
      "open",
      "close",
      "high",
      "low",
      "volume",
      "turnover",
      "amplitude",
      "changePercent",
      "change",
      "turnoverRate"
    ],
    "mapping": {
      "symbol": "symbol",
      "period": "period",
      "adjust": "adjust",
      "limit": "limit"
    },
    "defaults": {
      "period": "day",
      "adjust": "forward",
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.eastmoney.sectors",
    "provider": "opencli",
    "group": "finance",
    "site": "eastmoney",
    "command": "sectors",
    "module": "eastmoney/sectors.js",
    "description": "板块排行（行业/概念/地域）按涨跌幅、主力资金或成交额排序",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "type": {
          "type": "string",
          "description": "板块类型：industry / concept / region",
          "maxLength": 300
        },
        "sort": {
          "type": "string",
          "description": "排序：change / drop / money-flow / out-flow / turnover",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "返回数量 (max 100)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "code",
      "name",
      "price",
      "changePercent",
      "mainNet",
      "leadStock",
      "leadChangePercent",
      "upCount",
      "downCount"
    ],
    "mapping": {
      "type": "type",
      "sort": "sort",
      "limit": "limit"
    },
    "defaults": {
      "type": "industry",
      "sort": "change",
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.eastmoney.index-board",
    "provider": "opencli",
    "group": "finance",
    "site": "eastmoney",
    "command": "index-board",
    "module": "eastmoney/index-board.js",
    "description": "主要市场指数行情（A股 / 港股 / 美股）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "group": {
          "type": "string",
          "description": "指数分组：main (A股主要), hk (港股), us (美股), all",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "code",
      "name",
      "price",
      "changePercent",
      "change",
      "open",
      "high",
      "low",
      "prevClose"
    ],
    "mapping": {
      "group": "group"
    },
    "defaults": {
      "group": "main"
    },
    "idTypes": {}
  },
  {
    "id": "opencli.eastmoney.etf",
    "provider": "opencli",
    "group": "finance",
    "site": "eastmoney",
    "command": "etf",
    "module": "eastmoney/etf.js",
    "description": "ETF 列表按成交额/涨跌幅排行",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "sort": {
          "type": "string",
          "description": "排序：turnover / change / drop / volume / rate",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "返回数量 (max 100)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "rank",
      "code",
      "name",
      "price",
      "changePercent",
      "change",
      "turnover",
      "volume",
      "turnoverRate"
    ],
    "mapping": {
      "sort": "sort",
      "limit": "limit"
    },
    "defaults": {
      "sort": "turnover",
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.eastmoney.announcement",
    "provider": "opencli",
    "group": "finance",
    "site": "eastmoney",
    "command": "announcement",
    "module": "eastmoney/announcement.js",
    "description": "上市公司公告（按交易所筛选）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "market": {
          "type": "string",
          "description": "交易所：SHA (沪) / SZA (深) / BJA (北) 可逗号分隔",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "返回数量 (max 100)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "time",
      "code",
      "name",
      "title",
      "category",
      "url"
    ],
    "mapping": {
      "market": "market",
      "limit": "limit"
    },
    "defaults": {
      "market": "SHA,SZA,BJA",
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.eastmoney.kuaixun",
    "provider": "opencli",
    "group": "finance",
    "site": "eastmoney",
    "command": "kuaixun",
    "module": "eastmoney/kuaixun.js",
    "description": "东方财富 7x24 财经快讯",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "column": {
          "type": "string",
          "description": "频道：102 (重要) / 101 (全部) / 104 / 105 / 106 / 107",
          "maxLength": 300
        },
        "limit": {
          "type": "integer",
          "description": "返回数量 (max 100)",
          "minimum": 1,
          "maximum": 20
        }
      }
    },
    "columns": [
      "time",
      "title",
      "summary",
      "stocks"
    ],
    "mapping": {
      "column": "column",
      "limit": "limit"
    },
    "defaults": {
      "column": "102",
      "limit": 20
    },
    "idTypes": {}
  },
  {
    "id": "opencli.sinafinance.news",
    "provider": "opencli",
    "group": "finance",
    "site": "sinafinance",
    "command": "news",
    "module": "sinafinance/news.js",
    "description": "新浪财经 7x24 小时实时快讯",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [],
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Max results (max 50)",
          "minimum": 1,
          "maximum": 20
        },
        "type": {
          "type": "integer",
          "description": "News type: 0=全部 1=A股 2=宏观 3=公司 4=数据 5=市场 6=国际 7=观点 8=央行 9=其它",
          "minimum": 0,
          "maximum": 2147483647
        }
      }
    },
    "columns": [
      "id",
      "time",
      "content",
      "views"
    ],
    "mapping": {
      "limit": "limit",
      "type": "type"
    },
    "defaults": {
      "limit": 20,
      "type": 0
    },
    "idTypes": {}
  },
  {
    "id": "opencli.sinafinance.stock",
    "provider": "opencli",
    "group": "finance",
    "site": "sinafinance",
    "command": "stock",
    "module": "sinafinance/stock.js",
    "description": "新浪财经行情（A股/港股/美股）",
    "browser": false,
    "strategy": "public",
    "auth": "none",
    "readOnly": true,
    "refreshable": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "key"
      ],
      "properties": {
        "key": {
          "type": "string",
          "description": "Stock name or code (e.g. 贵州茅台, 腾讯控股, AAPL)",
          "maxLength": 300,
          "minLength": 1
        },
        "market": {
          "type": "string",
          "description": "Market: cn, hk, us, auto (default: auto searches cn → hk → us)",
          "maxLength": 300
        }
      }
    },
    "columns": [
      "Symbol",
      "Name",
      "Price",
      "Change",
      "ChangePercent",
      "Open",
      "High",
      "Low",
      "Volume",
      "MarketCap"
    ],
    "mapping": {
      "key": "key",
      "market": "market"
    },
    "defaults": {
      "market": "auto"
    },
    "idTypes": {}
  }
]
