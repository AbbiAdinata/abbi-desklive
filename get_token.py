import hmac
import hashlib
import requests

API_KEY = "XIUNMCYO-XOLKVCNH-6SAGQEPU-ZDG7YGEQ-LYGNZ3HP"      # GANTI
API_SECRET = "577c9c5ce2b497ff88281df35ef3a555b53ec5f97b11bc36ae4ae58f09c4acafa0030699445d9344"  # GANTI

body = f"client=tapi&tapi_key={API_KEY}"
sign = hmac.new(
    API_SECRET.encode('utf-8'),
    body.encode('utf-8'),
    hashlib.sha512
).hexdigest()

print(f"Sign: {sign}")

response = requests.post(
    "https://indodax.com/api/private_ws/v1/generate_token",
    headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "Sign": sign
    },
    data=body
)

print(response.json())

# Tambahkan di baris paling bawah, setelah get_private_token()
with open('token_output.txt', 'w') as f:
    f.write(f"VITE_INDODAX_WS_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDA3MzM5MDQ5sInN1YiI6IjQ3N2E0NTdmODg0d1900b48f6i2ec6627cc5524c27\n")
    f.write(f"CHANNEL=pws:#477e457df8804d1900b48f6i2ec6627cc5524c27\n")
print("Token tersimpan di token_output.txt")