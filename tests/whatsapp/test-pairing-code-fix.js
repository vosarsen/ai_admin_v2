#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'http://46.149.70.219:3000';
const COMPANY_ID = '962302';
const PHONE_NUMBER = '79686484488';

async function requestPairingCode(attempt = 1) {
    console.log(`\n📱 Attempt #${attempt}: Requesting pairing code...`);

    try {
        const response = await axios.post(
            `${API_URL}/api/whatsapp/sessions/${COMPANY_ID}/pairing-code`,
            { phoneNumber: PHONE_NUMBER },
            { timeout: 30000 }
        );

        if (response.data.success) {
            console.log(`✅ Success! Pairing code: ${response.data.code}`);
            console.log(`   Company ID: ${response.data.companyId}`);
            console.log(`   Phone: ${response.data.phoneNumber}`);
            console.log(`   Expires in: ${response.data.expiresIn} seconds`);
            return response.data.code;
        } else {
            console.error(`❌ Failed:`, response.data.error);
            return null;
        }
    } catch (error) {
        if (error.response) {
            console.error(`❌ API Error:`, error.response.data);
        } else if (error.code === 'ECONNABORTED') {
            console.error(`❌ Request timeout (30s)`);
        } else {
            console.error(`❌ Error:`, error.message);
        }
        return null;
    }
}

async function testMultipleRequests() {
    console.log('🧪 Testing multiple pairing code requests to verify each generates a new code\n');
    console.log('Server:', API_URL);
    console.log('Company:', COMPANY_ID);
    console.log('Phone:', PHONE_NUMBER);
    console.log('=' . repeat(60));

    const codes = [];
    const attempts = 3;

    for (let i = 1; i <= attempts; i++) {
        const code = await requestPairingCode(i);
        if (code) {
            codes.push(code);
        }

        // Wait 5 seconds between requests
        if (i < attempts) {
            console.log('\n⏳ Waiting 5 seconds before next request...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    console.log('\n' + '=' . repeat(60));
    console.log('📊 Results Summary:');
    console.log(`Total requests: ${attempts}`);
    console.log(`Successful: ${codes.length}`);
    console.log(`\nCodes received:`);
    codes.forEach((code, index) => {
        console.log(`  ${index + 1}. ${code}`);
    });

    // Check if all codes are unique
    const uniqueCodes = [...new Set(codes)];
    if (codes.length > 0) {
        if (uniqueCodes.length === codes.length) {
            console.log('\n✅ SUCCESS: All codes are unique! Fix is working.');
        } else {
            console.log('\n❌ ISSUE: Some codes are duplicated:');
            const counts = {};
            codes.forEach(code => {
                counts[code] = (counts[code] || 0) + 1;
            });
            Object.entries(counts).forEach(([code, count]) => {
                if (count > 1) {
                    console.log(`   ${code} appeared ${count} times`);
                }
            });
        }
    }
}

// Run the test
testMultipleRequests().catch(console.error);