# Oracle Cloud Always Free — VM setup for LaundryHub poller

This gets you a free-forever VM running the ConnectLife poller in ~20 minutes.

## 1. Create an Oracle Cloud account

1. Go to https://signup.cloud.oracle.com
2. Sign up. Oracle asks for a credit card for identity verification, but the
   Always Free tier has **no time limit** and you won't be charged as long as
   you stay within the free resource limits.
3. Choose a home region close to you — **Frankfurt (eu-frankfurt-1)** is good
   for Germany. Your home region can't be changed later.

## 2. Create the Always Free VM

1. In the console, search for "Instances" → **Create instance**.
2. **Name:** `laundryhub-poller`
3. **Image:** Change → **Canonical Ubuntu 22.04** (Always Free eligible)
4. **Shape:** Change → **Ampere** → `VM.Standard.A1.Flex` with **1 OCPU / 6 GB RAM**
   (Always Free includes 4 OCPUs and 24 GB RAM of Ampere; this uses a quarter.)

   If Ampere shows "Out of capacity", fall back to **AMD → VM.Standard.E2.1.Micro**
   (also Always Free — 1/8 OCPU, 1 GB RAM — still fine for this workload).

5. **Networking:** defaults are fine. Check "Assign a public IPv4 address".
6. **SSH keys:** either generate new (download the private key) or paste your
   existing `~/.ssh/id_rsa.pub`.
7. **Boot volume:** default 47 GB is fine.
8. Click **Create**.

Wait ~60 seconds until status is **Running**. Copy the **Public IP Address**.

## 3. Open port 22 (SSH) and nothing else

Oracle's default Virtual Cloud Network blocks most inbound ports. SSH (22) is
already allowed by default. The poller makes only outbound connections
(ConnectLife API + Firebase), so no other inbound rules are needed.

## 4. SSH in and run bootstrap

```bash
ssh -i /path/to/your-key.pem ubuntu@<your-public-ip>
```

If the firewall blocks you even on port 22, run `sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 22 -j ACCEPT` once on the VM console (Oracle's Ubuntu image has a local firewall in addition to the cloud-level one).

Then fetch and run the bootstrap script:

```bash
curl -O https://raw.githubusercontent.com/odongoperez/laundryhub/main/connectlife-poller/deploy/bootstrap.sh
chmod +x bootstrap.sh
sudo ./bootstrap.sh
```

## 5. Fill in secrets

The bootstrap creates `/etc/laundryhub/env` with placeholder values. Edit it:

```bash
sudo nano /etc/laundryhub/env
```

You need:

- `CONNECTLIFE_PASSWORD` — your ConnectLife password
- `FIREBASE_SERVICE_ACCOUNT_JSON` — the **entire JSON** from your Firebase
  service account key file, **on one line**. Get it from:
  Firebase Console → Project Settings → Service accounts → Generate new private key.

  To flatten JSON to one line: `jq -c . path/to/key.json` or paste into
  https://jsonformatter.org and hit "Compact".

Then restart:

```bash
sudo systemctl restart laundryhub-poller
sudo journalctl -u laundryhub-poller -f
```

You should see lines like:
```
2026-04-17T... INFO starting poller puid=1wfj0800029vw53t3pf0186 interval=10000ms
2026-04-17T... INFO [ConnectLife] authenticating
2026-04-17T... INFO [ConnectLife] authenticated uid=... token_exp=...
2026-04-17T... INFO poll ok 842ms | standby / Cotton Eco | fsm=idle relay=off
```

## 6. Daily operations

```bash
# Check it's alive
sudo systemctl status laundryhub-poller

# Tail live logs
sudo journalctl -u laundryhub-poller -f

# Update code after you push to GitHub
sudo laundryhub-update

# Edit secrets / change POLL_INTERVAL_MS
sudo nano /etc/laundryhub/env
sudo systemctl restart laundryhub-poller
```

## 7. Monitoring / stay-within-free

Oracle's Always Free limits are:
- 4 Ampere OCPUs + 24 GB RAM (or 2× AMD micro VMs), always free
- 10 TB outbound traffic/month (you'll use <100 MB)
- 200 GB block storage

You won't approach any of these. Set a $0 budget alert just in case:
Console → Billing & Cost Management → Budgets → Create Budget → Amount: $1,
Alert Rule: 100% actual. Email yourself.

## Known gotchas

- **VM gets reclaimed if "inactive"**: Oracle reclaims Always Free Ampere
  instances that have <20% CPU and <20% network for 7 consecutive days. The
  poller stays well above idle (polling every 10s), so you're safe.
- **ConnectLife T&C updates**: every few months ConnectLife updates their
  terms. The poller will start returning 500 errors. Open the ConnectLife
  mobile app, accept the new terms, and the poller recovers on its next cycle.
