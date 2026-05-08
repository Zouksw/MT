/**
 * Beef Commodity Data Import — All 5 Sheets
 *
 * Imports all sheets from beef.xlsx into PostgreSQL (Prisma).
 *
 * Sheet 1: 交易 — Daily trading quotes (4 products × factories × 8 dates)
 * Sheet 2: 录入 — Weekly master data (107 cuts × factories × 49 weeks × futures/spot)
 * Sheet 3: 基数表 — Reference table (cut + factory + country)
 * Sheet 4: 牛腩期货 — Brisket futures weekly prices
 * Sheet 5: 牛腩整合 — Brisket consolidated weekly prices
 *
 * Usage: npx tsx scripts/import-beef.ts
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

// ============ Python Parser ============

function parseAllSheets(): any {
  const script = `
import pandas as pd
import numpy as np
import json
import re

xls = pd.ExcelFile('/root/beef.xlsx')
result = {}

def clean_num(val):
    if val is None or str(val).strip() == '' or str(val) == 'nan':
        return None
    s = str(val).strip()
    if '/' in s:
        parts = s.split('/')
        for p in parts:
            try: return float(p.strip())
            except: continue
        return None
    try: return float(s)
    except:
        m = re.match(r'(\\d+\\.?\\d*)', s)
        return float(m.group(1)) if m else None

# ---- Sheet 1: 交易 ----
df = pd.read_excel(xls, sheet_name='交易', header=None)
from datetime import datetime, timedelta
def excel_date(s):
    return datetime(1899, 12, 30) + timedelta(days=int(s))

dates = []
for j in range(2, df.shape[1], 3):
    val = df.iloc[0, j]
    if pd.notna(val):
        dates.append(excel_date(float(val)).strftime('%Y-%m-%d'))

trading = []
cur_product = None
for i in range(2, df.shape[0]):
    name = df.iloc[i, 0]
    factory = df.iloc[i, 1]
    if pd.notna(name):
        cur_product = str(name).strip()
    if pd.notna(factory) and cur_product:
        entry = {'product': cur_product, 'factory': str(factory).strip(), 'datePrices': {}}
        for j, date in enumerate(dates):
            base = 2 + j * 3
            f = clean_num(df.iloc[i, base])
            b = clean_num(df.iloc[i, base + 1])
            s = clean_num(df.iloc[i, base + 2])
            if f or b or s:
                entry['datePrices'][date] = {'futures': f, 'buy': b, 'sell': s}
        trading.append(entry)
result['trading'] = trading

# ---- Sheet 2: 录入 ----
df2 = pd.read_excel(xls, sheet_name='录入', header=None)
weeks = []
for j in range(4, df2.shape[1], 2):
    val = df2.iloc[0, j]
    if pd.notna(val):
        weeks.append(str(val).strip())

recording = []
cur_product2 = None
for i in range(3, df2.shape[0]):
    name = df2.iloc[i, 0]
    if pd.notna(name):
        cur_product2 = str(name).strip()
    factory = df2.iloc[i, 2]
    country = df2.iloc[i, 3]
    if pd.notna(factory) and cur_product2:
        entry = {'product': cur_product2, 'factory': str(factory).strip(),
                 'country': str(country).strip() if pd.notna(country) else None, 'weekPrices': {}}
        for j, week in enumerate(weeks):
            col_f = 4 + j * 2
            col_s = 5 + j * 2
            f = clean_num(df2.iloc[i, col_f])
            s = clean_num(df2.iloc[i, col_s])
            if f or s:
                entry['weekPrices'][week] = {'futures_usd_ton': f, 'spot_cny_kg': s}
        recording.append(entry)
result['recording'] = recording

# ---- Sheet 3: 基数表 ----
df3 = pd.read_excel(xls, sheet_name='基数表', header=None)
reference = []
for i in range(1, df3.shape[0]):
    cut = df3.iloc[i, 0]
    factory = df3.iloc[i, 1]
    country = df3.iloc[i, 2]
    if pd.notna(cut) or pd.notna(factory):
        reference.append({
            'cut': str(cut).strip() if pd.notna(cut) else None,
            'factory': str(factory).strip() if pd.notna(factory) else None,
            'country': str(country).strip() if pd.notna(country) else None,
        })
result['reference'] = reference

# ---- Sheet 4: 牛腩期货 ----
df4 = pd.read_excel(xls, sheet_name='牛腩期货', header=None)
brisket_weeks = [str(df4.iloc[1, j]).strip() for j in range(2, df4.shape[1]) if pd.notna(df4.iloc[1, j])]
brisket_futures = []
for i in range(2, df4.shape[0]):
    cut = df4.iloc[i, 0]
    factory = df4.iloc[i, 1]
    if pd.notna(cut) or pd.notna(factory):
        entry = {'cut': str(cut).strip() if pd.notna(cut) else None,
                 'factory': str(factory).strip() if pd.notna(factory) else None,
                 'weekPrices': {}}
        for j, week in enumerate(brisket_weeks):
            col = 2 + j
            if col < df4.shape[1]:
                v = clean_num(df4.iloc[i, col])
                if v:
                    entry['weekPrices'][week] = v
        brisket_futures.append(entry)
result['brisket_futures'] = brisket_futures

# ---- Sheet 5: 牛腩整合 ----
df5 = pd.read_excel(xls, sheet_name='牛腩整合一个表', header=None)
brisket_weeks2 = [str(df5.iloc[1, j]).strip() for j in range(2, df5.shape[1]) if pd.notna(df5.iloc[1, j])]
brisket_combined = []
for i in range(2, df5.shape[0]):
    cut = df5.iloc[i, 0]
    factory = df5.iloc[i, 1]
    if pd.notna(cut) or pd.notna(factory):
        entry = {'cut': str(cut).strip() if pd.notna(cut) else None,
                 'factory': str(factory).strip() if pd.notna(factory) else None,
                 'weekPrices': {}}
        for j, week in enumerate(brisket_weeks2):
            col = 2 + j
            if col < df5.shape[1]:
                v = clean_num(df5.iloc[i, col])
                if v:
                    entry['weekPrices'][week] = v
        brisket_combined.append(entry)
result['brisket_combined'] = brisket_combined

print(json.dumps(result, ensure_ascii=False))
`;

  const output = execSync(`python3 << 'PYEOF'\n${script}\nPYEOF`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  });

  // Extract JSON from output (skip python warnings)
  const lines = output.trim().split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('{')) {
      return JSON.parse(line.trim());
    }
  }
  throw new Error('Failed to parse Python output');
}

async function main() {
  console.log('=== Beef Commodity Data Import (All 5 Sheets) ===\n');

  // 1. Parse xlsx
  console.log('Parsing beef.xlsx (all 5 sheets)...');
  const data = parseAllSheets();

  const tradingCount = data.trading?.length || 0;
  const recordingCount = data.recording?.length || 0;
  const refCount = data.reference?.length || 0;
  const brisketFuturesCount = data.brisket_futures?.length || 0;
  const brisketCombinedCount = data.brisket_combined?.length || 0;

  console.log(`  交易 (trading): ${tradingCount} entries`);
  console.log(`  录入 (recording): ${recordingCount} entries`);
  console.log(`  基数表 (reference): ${refCount} entries`);
  console.log(`  牛腩期货 (brisket futures): ${brisketFuturesCount} entries`);
  console.log(`  牛腩整合 (brisket combined): ${brisketCombinedCount} entries\n`);

  // 2. System user & org
  let systemUser = await prisma.user.findFirst({ where: { email: 'system@mt.local' } });
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: { email: 'system@mt.local', passwordHash: null, name: 'System', role: 'ADMIN' },
    });
  }

  let org = await prisma.organizations.findFirst({ where: { slug: 'beef-trading' } });
  if (!org) {
    org = await prisma.organizations.create({
      data: {
        id: 'org-beef-trading',
        owner_id: systemUser.id,
        name: 'Beef Trading',
        slug: 'beef-trading',
        description: 'Beef commodity trading analytics — 牛肉贸易数据分析',
      },
    });
    await prisma.organization_members.create({
      data: { id: 'member-system-beef', organization_id: org.id, user_id: systemUser.id, role: 'ADMIN' },
    });
  }

  let totalTS = 0;
  let totalDP = 0;

  // Helper: create dataset + timeseries + datapoints
  async function importSheet(
    sheetName: string,
    slug: string,
    description: string,
    entries: any[],
    getPriceEntries: (entry: any) => Array<{ dateKey: string; prices: any }>
  ) {
    const dataset = await prisma.dataset.upsert({
      where: { organization_id_slug: { organization_id: org!.id, slug } },
      update: {},
      create: {
        organization_id: org!.id,
        ownerId: systemUser!.id,
        name: `Beef - ${sheetName}`,
        slug,
        description,
        storageFormat: 'IOTDB_CACHE',
        commodityType: 'agriculture',
        currency: 'CNY',
        unit: 'CNY/kg',
        isPublic: true,
      },
    });

    let dpCount = 0;

    for (const entry of entries) {
      const product = entry.product || entry.cut || 'unknown';
      const factory = entry.factory || 'unknown';
      const tsSlug = `${product.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}_${factory.replace(/[^a-zA-Z0-9]/g, '_')}`.toLowerCase().substring(0, 100);

      const ts = await prisma.timeseries.upsert({
        where: { datasetId_slug: { datasetId: dataset.id, slug: tsSlug } },
        update: {},
        create: {
          datasetId: dataset.id,
          name: `${product} — ${factory}`,
          slug: tsSlug,
          description: entry.country ? `Country: ${entry.country}` : undefined,
          unit: 'CNY/kg',
        },
      });

      totalTS++;

      const priceEntries = getPriceEntries(entry);
      const datapoints = [];

      for (const { dateKey, prices } of priceEntries) {
        const valueJson: Record<string, any> = {};
        for (const [k, v] of Object.entries(prices)) {
          if (v != null) valueJson[k] = v;
        }
        if (Object.keys(valueJson).length > 0) {
          datapoints.push({
            timeseriesId: ts.id,
            timestamp: new Date(dateKey),
            valueJson: valueJson as any,
          });
        }
      }

      if (datapoints.length > 0) {
        await prisma.datapoint.createMany({ data: datapoints, skipDuplicates: true });
        dpCount += datapoints.length;
        totalDP += datapoints.length;
      }
    }

    console.log(`  ${sheetName}: ${entries.length} combos, ${dpCount} datapoints`);
  }

  // 3. Import Sheet 1: 交易 (daily trading)
  if (data.trading?.length) {
    await importSheet(
      '交易',
      'daily-trading',
      'Daily beef trading quotes — 每日牛肉交易报价',
      data.trading,
      (entry) =>
        Object.entries(entry.datePrices || {}).map(([date, prices]) => ({ dateKey: date, prices }))
    );
  }

  // 4. Import Sheet 2: 录入 (weekly recording)
  if (data.recording?.length) {
    // Convert week numbers to approximate dates (2025, week N)
    await importSheet(
      '录入',
      'weekly-recording',
      'Weekly beef price recording — 牛肉周价录入 (futures USD/ton, spot CNY/kg)',
      data.recording,
      (entry) =>
        Object.entries(entry.weekPrices || {}).map(([week, prices]) => {
          // Convert "18周" to approximate 2025 date
          const weekNum = parseInt(week.replace(/[^0-9]/g, ''));
          // Week 1 of 2025 = Jan 6 (Monday). Approximate.
          const janFirst = new Date(2025, 0, 6);
          const date = new Date(janFirst.getTime() + (weekNum - 1) * 7 * 86400000);
          return { dateKey: date.toISOString().split('T')[0], prices };
        })
    );
  }

  // 5. Import Sheet 4: 牛腩期货 (brisket futures)
  if (data.brisket_futures?.length) {
    await importSheet(
      '牛腩期货',
      'brisket-futures',
      'Brisket futures weekly prices — 牛腩期货周价',
      data.brisket_futures,
      (entry) =>
        Object.entries(entry.weekPrices || {}).map(([week, price]) => {
          const weekNum = parseInt(week.replace(/[^0-9]/g, ''));
          const janFirst = new Date(2025, 0, 6);
          const date = new Date(janFirst.getTime() + (weekNum - 1) * 7 * 86400000);
          return { dateKey: date.toISOString().split('T')[0], prices: { futures_cny_ton: price } };
        })
    );
  }

  // 6. Import Sheet 5: 牛腩整合 (brisket combined)
  if (data.brisket_combined?.length) {
    await importSheet(
      '牛腩整合',
      'brisket-combined',
      'Brisket consolidated weekly prices — 牛腩整合周价',
      data.brisket_combined,
      (entry) =>
        Object.entries(entry.weekPrices || {}).map(([week, price]) => {
          const weekNum = parseInt(week.replace(/[^0-9]/g, ''));
          const janFirst = new Date(2025, 0, 6);
          const date = new Date(janFirst.getTime() + (weekNum - 1) * 7 * 86400000);
          return { dateKey: date.toISOString().split('T')[0], prices: { futures_cny_ton: price } };
        })
    );
  }

  // 7. Store reference table as dataset metadata
  if (data.reference?.length) {
    const refDataset = await prisma.dataset.upsert({
      where: { organization_id_slug: { organization_id: org.id, slug: 'reference-cuts' } },
      update: {
        metadata: data.reference as any,
      },
      create: {
        organization_id: org.id,
        ownerId: systemUser.id,
        name: 'Beef - 基数表',
        slug: 'reference-cuts',
        description: 'Beef cut reference table — 牛肉部位对照表 (cut + factory + country)',
        storageFormat: 'CSV',
        commodityType: 'agriculture',
        currency: 'CNY',
        unit: 'CNY/kg',
        isPublic: true,
        metadata: data.reference as any,
      },
    });
    console.log(`  基数表: ${data.reference.length} reference entries stored as metadata`);
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Total Timeseries: ${totalTS}`);
  console.log(`Total Datapoints: ${totalDP}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Import failed:', e);
  process.exit(1);
});
