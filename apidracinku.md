Authentication
X-API-Key: 6G7C-RL57-2Z8O-ZVER

Base URL
https://api.dracinku.site

Platforms
Replace {platform} in any path with one of:
dramabox
shortmax
dramadash
flickreels
goodshort
melolo
netshort
reelbuzz
freereels
dramamax
flickshort
radreels
hishort
dramawave
litetv
chill
dramarush
meloshort
dramanova
microdrama
shorten

Endpoints


1. GET /{platform}/languages
"get list of available languages for platform"

Response (JSON)
{
  "success": true,
  "platform": "netshort",
  "data": {
    "supported": [
      "id",
    ],
    "mapping": {
      "id": "id_ID",
    }
  }
}

2. GET /{platform}/tablist
"get list of content category/tab"
Query Parameters
lang {lang_code}

Response (JSON)
{
  "success": true,
  "platform": "dramadash",
  "language": "id",
  "data": [
    {
      "type": "tab",
      "name": "Populer",
      "tab_key": "0",
      "position_index": 0
    },
    {
      "type": "tab",
      "name": "Baru",
      "tab_key": "2",
      "position_index": 1
    }
  ]
}

3. POST /{platform}/tabdata
"get content for a spesific categpry"
Query Parameters
lang {lang_code}

Request Body (JSON)
{
  "key": "{tab_key}",
  "positionIndex": "{position_index}",
  "type": "{type}"
}

Response (JSON)
{
  "success": true,
  "data": {
    "book": {
      "list": [
        {
          "id": "42000002890",
          "name": "Kembalinya Sang Petinju",
          "cover": "https://...",
          "chapterCount": 72,
          "tags": [
            "Balas Dendam",
            "Modern"
          ],
          "playCount": "9.5M"
        }
      ]
    },
    "page_info": {
      "has_more": true,
      "pageNo": 1,
      "pageSize": 15
    }
  }
}

4. POST /{platform}/tabfeed
"pagination - load next page of content"
Query Parameters
lang {lang_code}

Request Body (JSON)
{
  "page_info": "{page_info from tabdata}"
}

Response (JSON)
{
  "success": true,
  "data": {
    "book": [
      {
        "id": "42000002888",
        "name": "Dewa Judi",
        "chapterCount": 74,
        "playCount": "18.4M"
      }
    ],
    "page_info": {
      "has_more": true,
      "pageNo": 2,
      "pageSize": 15
    }
  }
}

5. GET /{platform}/series/{id}
"get series details and episode list with url"
Query Parameters
lang {lang_code}
qualityint — video quality

Response (JSON)
{
  "success": true,
  "data": {
    "book": {
      "id": "58",
      "name": "Balikan Cinta dengan Mantan Suami",
      "chapterCount": 80,
      "introduction": "Setelah bercerai, Isabella meraih kesuksesan…"
    },
    "chapters": [
      {
        "eps": "EP-1",
        "index": 1,
        "videoPath": "{url_video}",
        "subtitle": [
          {
            "language": "id",
            "display_name": "Indonesian",
            "subtitle": "{url_subtitle}"
          }
        ]
      }
    ]
  }
}


Example Request
cURL

curl -X GET "https://api.dracinku.site/dramabox/tablist?lang=id" \
  -H "X-API-Key: 6G7C-RL57-2Z8O-ZVER"