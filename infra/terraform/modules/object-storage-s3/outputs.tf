# SPDX-License-Identifier: BUSL-1.1

output "evidence_bucket" { value = aws_s3_bucket.evidence.id }
output "archive_bucket"  { value = aws_s3_bucket.archive.id }
output "reports_bucket"  { value = aws_s3_bucket.reports.id }
output "evidence_arn"    { value = aws_s3_bucket.evidence.arn }
