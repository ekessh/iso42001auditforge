{{/* SPDX-License-Identifier: BUSL-1.1 */}}
{{- define "audit-evidence-runner.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "audit-evidence-runner.fullname" -}}
{{- printf "%s-%s" .Release.Name "audit-runner" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "audit-evidence-runner.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "audit-evidence-runner.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: audit-evidence-runner
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: auditforge
{{- end -}}

{{- define "audit-evidence-runner.selectorLabels" -}}
app.kubernetes.io/name: {{ include "audit-evidence-runner.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: audit-evidence-runner
{{- end -}}

{{- define "audit-evidence-runner.image" -}}
{{- $registry := .Values.global.imageRegistry | default "" -}}
{{- $repo := .Values.image.repository -}}
{{- $tag := default .Chart.AppVersion .Values.image.tag -}}
{{- if $registry -}}
{{- printf "%s/%s:%s" $registry $repo $tag -}}
{{- else -}}
{{- printf "%s:%s" $repo $tag -}}
{{- end -}}
{{- end -}}
