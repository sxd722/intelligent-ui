// Metadata only: preserve old cards without pretending these commands exist in 1.8.6.
export const OPENCLI_LEGACY = [
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
  }
]
