{{/* SPDX-License-Identifier: BUSL-1.1 */}}
{{/*
AuditForge Helm template helpers.
*/}}

{{- define "auditforge.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "auditforge.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "auditforge.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "auditforge.labels" -}}
helm.sh/chart: {{ include "auditforge.chart" . }}
{{ include "auditforge.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: auditforge
{{- with .Values.global.labels }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{- define "auditforge.selectorLabels" -}}
app.kubernetes.io/name: {{ include "auditforge.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "auditforge.componentLabels" -}}
{{ include "auditforge.labels" . }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "auditforge.componentSelector" -}}
{{ include "auditforge.selectorLabels" .root }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "auditforge.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "auditforge.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/* Resolve an image reference honoring global.imageRegistry override. */}}
{{- define "auditforge.image" -}}
{{- $registry := .root.Values.global.imageRegistry -}}
{{- $repo := .image.repository -}}
{{- $tag := default .root.Chart.AppVersion .image.tag -}}
{{- if $registry -}}
{{- printf "%s/%s:%s" $registry $repo $tag -}}
{{- else -}}
{{- printf "%s:%s" $repo $tag -}}
{{- end -}}
{{- end -}}

{{- define "auditforge.imagePullPolicy" -}}
{{- $pp := default .root.Values.global.imagePullPolicy .image.pullPolicy -}}
{{ $pp }}
{{- end -}}

{{- define "auditforge.imagePullSecrets" -}}
{{- with .Values.global.imagePullSecrets }}
imagePullSecrets:
{{ toYaml . | indent 2 }}
{{- end }}
{{- end -}}

{{- define "auditforge.podSecurityContext" -}}
{{- toYaml .Values.podSecurityContext | nindent 2 }}
{{- end -}}

{{- define "auditforge.containerSecurityContext" -}}
{{- toYaml .Values.containerSecurityContext | nindent 4 }}
{{- end -}}

{{- define "auditforge.postgresHost" -}}
{{- if eq .Values.postgres.mode "external" -}}
{{ .Values.postgres.external.host }}
{{- else -}}
{{ include "auditforge.fullname" . }}-postgres
{{- end -}}
{{- end -}}

{{- define "auditforge.redisHost" -}}
{{- if eq .Values.redis.mode "external" -}}
{{ .Values.redis.external.host }}
{{- else -}}
{{ include "auditforge.fullname" . }}-redis
{{- end -}}
{{- end -}}

{{- define "auditforge.objectStorageEndpoint" -}}
{{- if eq .Values.objectStorage.mode "in-cluster" -}}
http://{{ include "auditforge.fullname" . }}-minio:9000
{{- else if .Values.objectStorage.s3.endpointOverride -}}
{{ .Values.objectStorage.s3.endpointOverride }}
{{- else -}}
https://s3.{{ .Values.objectStorage.s3.region }}.amazonaws.com
{{- end -}}
{{- end -}}
