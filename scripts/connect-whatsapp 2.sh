#!/bin/bash

# WhatsApp Connection Script for AI Admin
# Usage: ./connect-whatsapp.sh COMPANY_ID

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if company ID is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Company ID is required${NC}"
    echo "Usage: $0 COMPANY_ID"
    echo "Example: $0 962302"
    exit 1
fi

COMPANY_ID=$1
API_URL="http://localhost:3000"
SESSION_DIR="/opt/ai-admin/sessions/company_${COMPANY_ID}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  WhatsApp Connection for Company ${COMPANY_ID}${NC}"
echo -e "${GREEN}========================================${NC}"
echo

# Step 1: Check current status
echo -e "${YELLOW}Checking current status...${NC}"
STATUS=$(curl -s "${API_URL}/webhook/whatsapp/baileys/status/${COMPANY_ID}" | jq -r '.status.connected')

if [ "$STATUS" == "true" ]; then
    echo -e "${GREEN}✅ WhatsApp is already connected for company ${COMPANY_ID}${NC}"
    PHONE=$(curl -s "${API_URL}/webhook/whatsapp/baileys/status/${COMPANY_ID}" | jq -r '.status.user.id')
    echo -e "${GREEN}Connected to: ${PHONE}${NC}"
    
    read -p "Do you want to reconnect with a new number? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
    
    # Clear old session
    echo -e "${YELLOW}Clearing old session...${NC}"
    rm -rf "${SESSION_DIR}"
    
    # Restart API to reinitialize
    pm2 restart ai-admin-api > /dev/null 2>&1
    sleep 3
fi

# Step 2: Generate QR code
echo -e "${YELLOW}Generating QR code...${NC}"

# Try to get QR code
MAX_ATTEMPTS=5
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    QR_RESPONSE=$(curl -s "${API_URL}/webhook/whatsapp/baileys/qr/${COMPANY_ID}")
    QR_CODE=$(echo "$QR_RESPONSE" | jq -r '.qr')
    
    if [ "$QR_CODE" != "null" ] && [ ! -z "$QR_CODE" ]; then
        break
    fi
    
    echo -e "${YELLOW}Waiting for QR code... (attempt $ATTEMPT/$MAX_ATTEMPTS)${NC}"
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

if [ "$QR_CODE" == "null" ] || [ -z "$QR_CODE" ]; then
    echo -e "${RED}Failed to generate QR code${NC}"
    echo -e "${YELLOW}Try restarting the API: pm2 restart ai-admin-api${NC}"
    exit 1
fi

# Step 3: Display QR code
echo -e "${GREEN}QR Code generated successfully!${NC}"
echo
echo -e "${YELLOW}Option 1: Scan QR code in terminal${NC}"
echo "Installing qrencode if not present..."
which qrencode > /dev/null 2>&1 || apt-get install -y qrencode > /dev/null 2>&1

echo "$QR_CODE" | qrencode -t UTF8
echo
echo -e "${YELLOW}Option 2: Open in browser${NC}"
echo -e "${GREEN}http://46.149.70.219:3000/whatsapp-connect.html?company=${COMPANY_ID}${NC}"
echo

# Step 4: Wait for connection
echo -e "${YELLOW}Waiting for authentication...${NC}"
echo "Please scan the QR code with WhatsApp:"
echo "1. Open WhatsApp on your phone"
echo "2. Go to Settings → Linked Devices"
echo "3. Tap 'Link a Device'"
echo "4. Scan the QR code"
echo

# Check for connection
CONNECTED=false
TIMEOUT=120  # 2 minutes timeout
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    STATUS_CHECK=$(curl -s "${API_URL}/webhook/whatsapp/baileys/status/${COMPANY_ID}")
    CONNECTED_STATUS=$(echo "$STATUS_CHECK" | jq -r '.status.connected')
    
    if [ "$CONNECTED_STATUS" == "true" ]; then
        CONNECTED=true
        break
    fi
    
    printf "."
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

echo

if [ "$CONNECTED" == "true" ]; then
    echo -e "${GREEN}✅ Successfully connected!${NC}"
    PHONE=$(curl -s "${API_URL}/webhook/whatsapp/baileys/status/${COMPANY_ID}" | jq -r '.status.user.id')
    echo -e "${GREEN}Connected to: ${PHONE}${NC}"
    
    # Test message
    echo
    echo -e "${YELLOW}Sending test message...${NC}"
    
    TEST_RESPONSE=$(curl -s -X POST "${API_URL}/webhook/whatsapp/baileys/send" \
        -H "Content-Type: application/json" \
        -d "{
            \"companyId\": \"${COMPANY_ID}\",
            \"phone\": \"79686484488\",
            \"message\": \"✅ WhatsApp successfully connected for company ${COMPANY_ID}\"
        }")
    
    SUCCESS=$(echo "$TEST_RESPONSE" | jq -r '.success')
    
    if [ "$SUCCESS" == "true" ]; then
        echo -e "${GREEN}✅ Test message sent successfully!${NC}"
    else
        echo -e "${YELLOW}⚠️ Could not send test message${NC}"
    fi
    
    echo
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  WhatsApp is ready for company ${COMPANY_ID}!${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "${RED}❌ Connection timeout${NC}"
    echo -e "${YELLOW}Please try again or use the web interface:${NC}"
    echo -e "${GREEN}http://46.149.70.219:3000/whatsapp-connect.html?company=${COMPANY_ID}${NC}"
    exit 1
fi