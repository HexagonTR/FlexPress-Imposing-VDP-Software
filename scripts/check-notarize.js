const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function checkNotarize() {
    const appleId = process.env.MANUAL_APPLE_ID;
    const appleIdPassword = process.env.MANUAL_APPLE_APP_SPECIFIC_PASSWORD || process.env.MANUAL_APPLE_ID_PASSWORD;
    const teamId = process.env.MANUAL_APPLE_TEAM_ID;

    if (!appleId || !appleIdPassword || !teamId) {
        console.error("❌ Credentials missing.");
        process.exit(1);
    }

    const idFilePath = path.join(process.cwd(), '.notarization_id');
    if (!fs.existsSync(idFilePath)) {
        console.log("ℹ️ No active notarization ID found. Skipping.");
        return;
    }

    const submissionId = fs.readFileSync(idFilePath, 'utf8').trim();
    if (!submissionId) {
        console.log("ℹ️ Notarization ID is empty. Skipping.");
        process.exit(0);
    }
    console.log(`🔍 Checking status for Submission ID: ${submissionId}`);

    try {
        const args = [
            'notarytool', 'info',
            submissionId,
            '--apple-id', appleId,
            '--password', appleIdPassword,
            '--team-id', teamId,
            '--verbose'
        ];

        console.log("⏳ Waiting for Apple response...");
        const { output } = await runCommand('xcrun', args);

        if (output.includes('status: Accepted')) {
            console.log("✅ NOTARIZATION_ACCEPTED=true");
            if (process.env.GITHUB_OUTPUT) {
                fs.appendFileSync(process.env.GITHUB_OUTPUT, `accepted=true\n`);
            }
            process.exit(0);
        } else if (output.includes('status: In Progress') || output.includes('status: Processing')) {
            console.log("⏳ STILL_PROCESSING=true");
            process.exit(0);
        } else {
            console.error("❌ TERMINAL_FAILURE=true");
            console.error(output);
            process.exit(1);
        }
    } catch (error) {
        console.error("❌ ERROR=", error.message);
        process.exit(1);
    }
}

function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        let output = '';
        const child = spawn(command, args);
        child.stdout.on('data', (data) => output += data.toString());
        child.stderr.on('data', (data) => output += data.toString());
        child.on('close', (code) => {
            if (code === 0) resolve({ code, output });
            else {
                const err = new Error(`${command} failed. Output: ${output}`);
                err.output = output;
                reject(err);
            }
        });
    });
}

checkNotarize();
