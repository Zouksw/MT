-- D3 (v3.2.0 batch 4): drop the portfolios scaffolding with its route group.
-- 0 rows in production at drop time (backed up together with the D2 tables
-- in backups/round140-d2/dormant-tables.sql); the /api/portfolios route and
-- its tests were the only code face (no page ever consumed it — round-132
-- registered 0 frontend consumers; the GroupMember "correlation overlay"
-- comment referenced an /api/analytics/correlation endpoint deleted in
-- round-132).

DROP TABLE "group_members";
DROP TABLE "portfolios";
