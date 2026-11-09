-- VirusTotal を照会先から外した (ADR 0012)。照会先は MalwareBazaar だけになる。
DELETE FROM scans WHERE scanner = 'virustotal';
