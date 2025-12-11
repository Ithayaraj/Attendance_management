import dotenv from 'dotenv';
dotenv.config();

const testScan = async () => {
    const deviceKey = 'esp32-dev-key';
    const registrationNo = '2019/ICTS/05'; // The student Senthuran

    console.log('Testing Local Scan Logic for Senthuran...');
    console.log(`Scanning: ${registrationNo}`);
    console.log('Target: Localhost (Fixed Code)');
    console.log('--------------------------------------------------');

    try {
        const response = await fetch('http://localhost:5000/api/scans/ingest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Device-Key': deviceKey
            },
            body: JSON.stringify({
                registrationNo: registrationNo
            })
        });

        const data = await response.json();

        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('--------------------------------------------------');
            console.log('✅ SUCCESS: Local logic successfully found the session!');
            console.log(`Matched to: ${data.data.session.courseCode} (${data.data.session.date})`);
        } else {
            console.log('❌ FAILED: ' + data.message);
        }
    } catch (error) {
        console.log('Error:', error.message);
    }
};

testScan();
