# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.50.0" }
  }
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(var.tags, { Name = var.name })
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnets)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnets[count.index]
  availability_zone = var.azs[count.index]
  tags              = merge(var.tags, { Name = "${var.name}-private-${count.index}", "kubernetes.io/role/internal-elb" = "1" })
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnets)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnets[count.index]
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = false
  tags                    = merge(var.tags, { Name = "${var.name}-public-${count.index}", "kubernetes.io/role/elb" = "1" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = var.tags
}

resource "aws_eip" "nat" {
  count  = length(var.public_subnets)
  domain = "vpc"
  tags   = var.tags
}

resource "aws_nat_gateway" "this" {
  count         = length(var.public_subnets)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  tags          = var.tags
  depends_on    = [aws_internet_gateway.this]
}

resource "aws_flow_log" "this" {
  count                = var.flow_logs_bucket_arn == "" ? 0 : 1
  log_destination_type = "s3"
  log_destination      = var.flow_logs_bucket_arn
  traffic_type         = "ALL"
  vpc_id               = aws_vpc.this.id
}
