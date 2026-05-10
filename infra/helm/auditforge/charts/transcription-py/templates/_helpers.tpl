{{/* SPDX-License-Identifier: BUSL-1.1 */}}
{{- define "transcription-py.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "transcription-py.fullname" -}}
{{- printf "%s-%s" .Release.Name "transcription" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "transcription-py.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "transcription-py.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: transcription-py
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: auditforge
{{- end -}}

{{- define "transcription-py.selectorLabels" -}}
app.kubernetes.io/name: {{ include "transcription-py.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: transcription-py
{{- end -}}

{{- define "transcription-py.image" -}}
{{- $registry := .Values.global.imageRegistry | default "" -}}
{{- $repo := .Values.image.repository -}}
{{- $tag := default .Chart.AppVersion .Values.image.tag -}}
{{- if $registry -}}
{{- printf "%s/%s:%s" $registry $repo $tag -}}
{{- else -}}
{{- printf "%s:%s" $repo $tag -}}
{{- end -}}
{{- end -}}
