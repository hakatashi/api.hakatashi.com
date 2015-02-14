# api.hakatashi.com

[![Dependency Status](https://gemnasium.com/hakatashi/api.hakatashi.com.svg)](https://gemnasium.com/hakatashi/api.hakatashi.com)

## Documentation

### POST /pyoncrypt/encode

Encrypt text into pyoncrypt

#### Parameters

| Parameter         | Description                         |
| ----------------- | ----------------------------------- |
| `text` (required) | The text to encrypt, UTF-8 encoded. |
| `pass`            | The password which is used to encrypt text. If omitted, the server-configured default password will be used. |

#### Example Request

POST https://api.hakatashi.com/pyoncrypt/encode?text=%E3%81%BB%E3%81%92&pass=password

#### Example Result

```json
{
  "result": "ぴょぴょこぴょんぴょんぴょーんぴょんぴょ、ぴょぴょんぴょこぴょーんぴょんぴょこぴょ…",
  "text": "ほげ"
}
```

### POST /pyoncrypt/decode

Decrypt pyoncrypt into text

#### Parameters

| Parameter         | Description                                 |
| ----------------- | ------------------------------------------- |
| `text` (required) | The text to decrypt, UTF-8 encoded.         |
| `pass` (required) | The password which is used to decrypt text. |

#### Example Request

POST https://api.hakatashi.com/pyoncrypt/decode?text=%E3%81%B4%E3%82%87%E3%81%B4%E3%82%87%E3%81%93%E3%81%B4%E3%82%87%E3%82%93%E3%81%B4%E3%82%87%E3%82%93%E3%81%B4%E3%82%87%E3%83%BC%E3%82%93%E3%81%B4%E3%82%87%E3%82%93%E3%81%B4%E3%82%87%E3%80%81%E3%81%B4%E3%82%87%E3%81%B4%E3%82%87%E3%82%93%E3%81%B4%E3%82%87%E3%81%93%E3%81%B4%E3%82%87%E3%83%BC%E3%82%93%E3%81%B4%E3%82%87%E3%82%93%E3%81%B4%E3%82%87%E3%81%93%E3%81%B4%E3%82%87%E2%80%A6&pass=password

#### Example Result

```json
{
  "result": "ほげ",
  "text": "ぴょぴょこぴょんぴょんぴょーんぴょんぴょ、ぴょぴょんぴょこぴょーんぴょんぴょこぴょ…"
}
```
