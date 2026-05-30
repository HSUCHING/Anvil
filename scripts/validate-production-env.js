#!/usr/bin/env node
/*
 * Validates the production Docker Compose environment before deployment.
 * This intentionally avoids external dependencies so it can run on a fresh server.
 */
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const envArgIndex = args.indexOf('--env');
const envFile = path.resolve(rootDir, envArgIndex >= 0 && args[envArgIndex + 1] ? args[envArgIndex + 1] : '.env');
const composeFile = path.resolve(rootDir, 'compose.production.yaml');

const required = [
    'GHOST_URL',
    'MYSQL_ROOT_PASSWORD',
    'MYSQL_PASSWORD',
    'MAIL_FROM',
    'MAIL_HOST',
    'MAIL_USER',
    'MAIL_PASSWORD'
];

const optionalDefaults = {
    GATEWAY_HTTP_PORT: '2368',
    MYSQL_DATABASE: 'ghost_dev',
    MYSQL_USER: 'ghost',
    MAIL_TRANSPORT: 'SMTP',
    MAIL_PORT: '587'
};

const placeholderPatterns = [
    /^change-me/i,
    /^your-/i,
    /^example/i,
    /example\.com/i,
    /^root$/i,
    /^ghost$/i,
    /^password$/i,
    /^secret$/i,
    /^smtp\.example\.com$/i
];

function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    const values = {};
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }

        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match) {
            continue;
        }

        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
            value = value.slice(1, -1);
        }

        values[match[1]] = value;
    }

    return values;
}

function hasPlaceholderValue(value) {
    return placeholderPatterns.some(pattern => pattern.test(value));
}

function printSection(title, items) {
    if (items.length === 0) {
        return;
    }

    console.log(`\n${title}`);
    for (const item of items) {
        console.log(`- ${item}`);
    }
}

const fileEnv = parseEnvFile(envFile);
const errors = [];
const warnings = [];
const info = [];

if (!fileEnv) {
    errors.push(`Missing env file: ${path.relative(rootDir, envFile)}. Create it with: cp .env.example .env`);
} else {
    info.push(`Loaded ${path.relative(rootDir, envFile)}`);
}

const effectiveEnv = {...(fileEnv || {})};
for (const key of new Set([...required, ...Object.keys(optionalDefaults)])) {
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
        if (fileEnv && Object.prototype.hasOwnProperty.call(fileEnv, key) && process.env[key] !== fileEnv[key]) {
            warnings.push(`${key} is set in both ${path.relative(rootDir, envFile)} and the shell; Docker Compose will prefer the shell value.`);
        }
        effectiveEnv[key] = process.env[key];
    }
}

for (const key of required) {
    const value = effectiveEnv[key];
    if (!value) {
        errors.push(`Missing required variable: ${key}`);
    } else if (hasPlaceholderValue(value)) {
        errors.push(`${key} still looks like a placeholder or weak default.`);
    }
}

for (const [key, defaultValue] of Object.entries(optionalDefaults)) {
    if (!effectiveEnv[key]) {
        info.push(`${key} not set; compose default will be used: ${defaultValue}`);
    }
}

if (effectiveEnv.GHOST_URL) {
    try {
        const url = new URL(effectiveEnv.GHOST_URL);
        if (!['http:', 'https:'].includes(url.protocol)) {
            errors.push('GHOST_URL must start with http:// or https://');
        }
        if (url.protocol !== 'https:') {
            warnings.push('GHOST_URL is not HTTPS. For public production sites, use HTTPS behind Nginx/Cloudflare.');
        }
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            warnings.push('GHOST_URL points to localhost. Use the public site URL for production.');
        }
    } catch (err) {
        errors.push('GHOST_URL is not a valid URL.');
    }
}

if (effectiveEnv.MAIL_FROM) {
    const from = effectiveEnv.MAIL_FROM;
    const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s<>]+@[^\s<>]+)/);
    const email = emailMatch ? emailMatch[1] : '';
    if (!email.includes('@')) {
        errors.push('MAIL_FROM must include an email address, for example: xcognix <noreply@mail.example.com>');
    } else {
        const domain = email.split('@').pop();
        if (effectiveEnv.GHOST_URL) {
            try {
                const siteHost = new URL(effectiveEnv.GHOST_URL).hostname;
                if (domain === siteHost) {
                    warnings.push(`MAIL_FROM uses the site host (${domain}). Make sure this exact domain is verified by your SMTP provider.`);
                }
            } catch (err) {
                // GHOST_URL validation reports this separately.
            }
        }
    }
}

if (effectiveEnv.MAIL_PORT && !/^\d+$/.test(effectiveEnv.MAIL_PORT)) {
    errors.push('MAIL_PORT must be a number.');
}

if (effectiveEnv.GATEWAY_HTTP_PORT && !/^\d+$/.test(effectiveEnv.GATEWAY_HTTP_PORT)) {
    errors.push('GATEWAY_HTTP_PORT must be a number.');
}

if (fs.existsSync(composeFile)) {
    const composeEnv = {...process.env, ...effectiveEnv};
    const compose = spawnSync('docker', ['compose', '-f', 'compose.production.yaml', 'config', '--quiet'], {
        cwd: rootDir,
        env: composeEnv,
        encoding: 'utf8'
    });

    if (compose.error) {
        warnings.push(`Could not run docker compose config: ${compose.error.message}`);
    } else if (compose.status !== 0) {
        errors.push(`docker compose config failed:\n${compose.stderr.trim() || compose.stdout.trim()}`);
    } else {
        info.push('docker compose production config parsed successfully.');
    }
} else {
    errors.push('Missing compose.production.yaml');
}

console.log('Production environment check');
console.log('============================');
printSection('Info', info);
printSection('Warnings', warnings);
printSection('Errors', errors);

if (errors.length > 0) {
    console.log('\nResult: failed');
    process.exit(1);
}

console.log('\nResult: passed');
