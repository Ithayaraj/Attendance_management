import dotenv from 'dotenv';
dotenv.config();

const testScan = async () => {
    const deviceKey = 'esp32-dev-key';
    const registrationNo = '2019/ICTS/05';  // ICTS student (Senthuran)

    console.log('Testing ICTS student scan...');
    console.log('Registration:', registrationNo);
    console.log('');

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

        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));
        console.log('');

        if (data.success) {
            console.log('RESULT: Student was ALLOWED to session:', data.data?.session?.courseCode);
            if (data.data?.session?.courseCode?.startsWith('BIO')) {
                console.log('❌ BUG! ICTS student was allowed in BIO session!');
            } else if (data.data?.session?.courseCode?.startsWith('TICT')) {
                console.log('✅ Correct - ICTS student matched to ICTS session');
            }
        } else {
            console.log('RESULT: Student was REJECTED');
            console.log('Reason:', data.message);
        }
    } catch (error) {
        console.log('Error:', error.message);
    }
};

testScan();
