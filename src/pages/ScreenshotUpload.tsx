import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import UnsupportedScreenshotModal from '../components/UnsupportedScreenshotModal'
import PageBackButton from '../components/PageBackButton'
import useAppBack from '../hooks/useAppBack'
import {
  MAX_CAPTURE_FILE_SIZE_BYTES,
  SUPPORTED_CAPTURE_MIME_TYPES,
  validateCaptureFile,
  type CaptureFileValidationResult,
} from '../capture/fileValidation'
import { extractSubscriptionScreenshot, type ExtractionErrorCode } from '../ai/extractionClient'
import { createAiCaptureDraft } from '../capture/aiCaptureDraft'

type CaptureShellState = 'empty' | 'selected' | 'analyzing' | 'timeout' | 'failure' | 'preview_lost'

interface CaptureLocationState {
  from?: string
  initialCaptureState?: CaptureShellState | 'unsupported'
}

interface SelectedImage {
  file: File
  previewUrl: string
}

function getLocationState(value: unknown): CaptureLocationState {
  return typeof value === 'object' && value !== null ? (value as CaptureLocationState) : {}
}

function validationMessage(result: CaptureFileValidationResult): string {
  switch (result.status) {
    case 'unsupported_type':
      return '请选择 PNG、JPEG 或 WebP 截图。'
    case 'file_too_large':
      return `请选择小于 ${Math.round(MAX_CAPTURE_FILE_SIZE_BYTES / 1024 / 1024)} MB 的图片。`
    case 'empty_file':
      return '请选择非空截图文件。'
    case 'valid':
      return ''
  }
}

export default function ScreenshotUpload() {
  const navigate = useNavigate()
  const navigateBack = useAppBack('/subscriptions')
  const location = useLocation()
  const locationState = getLocationState(location.state)
  const initialState = locationState.initialCaptureState
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null)
  const [captureState, setCaptureState] = useState<CaptureShellState>(
    initialState && initialState !== 'unsupported' ? initialState : 'empty',
  )
  const [isUnsupportedOpen, setIsUnsupportedOpen] = useState(initialState === 'unsupported')
  const [fileError, setFileError] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [showManualOptions, setShowManualOptions] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const analysisTokenRef = useRef(0)

  useEffect(() => {
    return () => {
      if (selectedImage) {
        URL.revokeObjectURL(selectedImage.previewUrl)
      }
    }
  }, [selectedImage])

  function clearPendingAnalysis() {
    analysisTokenRef.current += 1
  }

  function clearSelectedImage() {
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage.previewUrl)
    }
    setSelectedImage(null)
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const validation = validateCaptureFile(file)
    if (validation.status !== 'valid') {
      setFileError(validationMessage(validation))
      return
    }

    const previewUrl = URL.createObjectURL(file)
    clearPendingAnalysis()
    clearSelectedImage()
    setSelectedImage({ file, previewUrl })
    setCaptureState('selected')
    setFileError(null)
    setAnalysisError(null)
    setShowManualOptions(false)
  }

  function handleRemoveImage() {
    clearPendingAnalysis()
    clearSelectedImage()
    setCaptureState('empty')
    setFileError(null)
    setAnalysisError(null)
  }

  async function handleAnalyze() {
    if (!selectedImage || captureState === 'analyzing') return
    clearPendingAnalysis()
    const token = analysisTokenRef.current
    setCaptureState('analyzing')
    setAnalysisError(null)

    try {
      const result = await extractSubscriptionScreenshot(selectedImage.file)
      if (analysisTokenRef.current !== token) {
        return
      }

      if (result.ok) {
        const draft = createAiCaptureDraft({
          file: selectedImage.file,
          previewUrl: selectedImage.previewUrl,
          response: result,
          capturedAt: new Date().toISOString(),
          sessionId: `capture_${selectedImage.file.name}_${selectedImage.file.size}_${Date.now()}`,
        })
        navigate('/review-extracted', {
          state: {
            from: '/scan-screenshot',
            draft,
          },
        })
      } else {
        setAnalysisError(analysisErrorMessage(result.error.code))
        setCaptureState('failure')
      }
    } catch {
      if (analysisTokenRef.current !== token) {
        return
      }
      setAnalysisError(analysisErrorMessage('PROVIDER_ERROR'))
      setCaptureState('failure')
    }
  }

  function handleCancelAnalysis() {
    clearPendingAnalysis()
    setCaptureState(selectedImage ? 'selected' : 'empty')
  }

  function handleBack() {
    navigateBack()
  }

  function openManualOptions() {
    clearPendingAnalysis()
    clearSelectedImage()
    setCaptureState('empty')
    setIsUnsupportedOpen(false)
    setShowManualOptions(true)
  }

  function navigateManual(path: '/add-trial' | '/add-paid') {
    clearPendingAnalysis()
    clearSelectedImage()
    navigate(path)
  }

  return (
    <div className="secondary-page space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">扫描截图</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            选择一张会员、订阅、订单或取消页面截图。
          </p>
        </div>
        <PageBackButton fallback="/subscriptions" label="返回" onBack={navigateBack} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-500">
        仅由用户主动上传。截图预览是临时的，不会被保存。
      </div>

      {captureState === 'preview_lost' ? (
        <StatePanel
          title="临时预览已不可用。"
          description="请重新选择截图，或继续手动录入。"
          primaryLabel="重新选择截图"
          onPrimary={() => setCaptureState('empty')}
          onManual={openManualOptions}
        />
      ) : captureState === 'timeout' ? (
        <StatePanel
          title="分析超时。"
          description="请重试、选择其他图片，或手动添加会员记录。"
          primaryLabel="重试"
          onPrimary={handleAnalyze}
          onManual={openManualOptions}
        />
      ) : (
        <>
          <div className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">
              {selectedImage ? '已选择截图' : '选择截图'}
            </span>
            <input
              ref={fileInputRef}
              id="screenshot-file-input"
              aria-label={selectedImage ? '替换截图' : '选择截图'}
              type="file"
              hidden={Boolean(selectedImage)}
              accept={SUPPORTED_CAPTURE_MIME_TYPES.join(',')}
              onChange={handleFileChange}
              className={
                selectedImage
                  ? undefined
                  : 'block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700'
              }
            />
            {selectedImage && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700"
              >
                替换截图
              </button>
            )}
          </div>

          {fileError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {fileError}
            </div>
          )}

          {!selectedImage ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center">
              <p className="text-sm font-medium text-gray-700">上传一张截图</p>
              <p className="mt-1 text-xs text-gray-500">
                支持 PNG、JPEG 或 WebP，最大 {Math.round(MAX_CAPTURE_FILE_SIZE_BYTES / 1024 / 1024)} MB。
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-gray-200 p-3">
              <img
                src={selectedImage.previewUrl}
                alt="已选择截图预览"
                className="max-h-72 w-full rounded-lg border border-gray-100 object-contain"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-gray-800">{selectedImage.file.name}</p>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 active:bg-gray-50"
                >
                  移除图片
                </button>
              </div>
            </div>
          )}

          {captureState === 'analyzing' && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-3">
              <p className="text-sm font-medium text-blue-700">正在分析截图…</p>
              <p className="mt-1 text-xs text-blue-600">临时预览只保留在当前页面。</p>
              <button
                type="button"
                onClick={handleCancelAnalysis}
                className="mt-3 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 active:bg-blue-100"
              >
                取消分析
              </button>
            </div>
          )}

          {captureState === 'failure' && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3">
              <p className="text-sm font-medium text-red-700">
                {analysisError ?? '暂时无法分析这张截图。'}
              </p>
              <p className="mt-1 text-xs text-red-600">
                请重试、选择其他图片，或手动添加会员记录。
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={captureState === 'failure' ? handleAnalyze : handleBack}
              className="rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-50"
            >
              {captureState === 'failure' ? '重试' : '取消'}
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!selectedImage || captureState === 'analyzing'}
              className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:bg-gray-200 disabled:text-gray-400"
            >
              开始分析
            </button>
          </div>
        </>
      )}

      {captureState !== 'timeout' && captureState !== 'preview_lost' && (
        <ManualFallback
          isOpen={showManualOptions}
          onOpen={openManualOptions}
          onFreeTrial={() => navigateManual('/add-trial')}
          onPaidMembership={() => navigateManual('/add-paid')}
        />
      )}

      <UnsupportedScreenshotModal
        isOpen={isUnsupportedOpen}
        onChooseAnother={() => setIsUnsupportedOpen(false)}
        onManualEntry={openManualOptions}
        onCancel={() => setIsUnsupportedOpen(false)}
      />
    </div>
  )
}

function analysisErrorMessage(code: ExtractionErrorCode): string {
  switch (code) {
    case 'AI_NOT_CONFIGURED':
      return 'AI 分析暂不可用。'
    case 'PROVIDER_TIMEOUT':
      return '分析时间过长，请重试。'
    case 'PROVIDER_ERROR':
      return 'AI 分析失败，请稍后重试。'
    case 'MODEL_OUTPUT_INVALID':
      return '无法可靠读取这张截图，请重试或手动添加。'
    case 'UNSUPPORTED_IMAGE_TYPE':
      return '请选择 PNG、JPEG 或 WebP 截图。'
    case 'IMAGE_TOO_LARGE':
      return `请选择小于 ${Math.round(MAX_CAPTURE_FILE_SIZE_BYTES / 1024 / 1024)} MB 的图片。`
    case 'INVALID_REQUEST':
    case 'INTERNAL_ERROR':
      return '暂时无法分析这张截图。'
  }
}

function StatePanel({
  title,
  description,
  primaryLabel,
  onPrimary,
  onManual,
}: {
  title: string
  description: string
  primaryLabel: string
  onPrimary: () => void
  onManual: () => void
}) {
  return (
    <div className="rounded-xl border border-gray-200 px-4 py-5 text-center">
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPrimary}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white active:bg-blue-700"
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={onManual}
          className="rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-50"
        >
          手动录入
        </button>
      </div>
    </div>
  )
}

function ManualFallback({
  isOpen,
  onOpen,
  onFreeTrial,
  onPaidMembership,
}: {
  isOpen: boolean
  onOpen: () => void
  onFreeTrial: () => void
  onPaidMembership: () => void
}) {
  return (
    <div className="rounded-lg border border-gray-100 px-3 py-3">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left text-sm font-medium text-blue-600"
      >
        手动录入
      </button>
      {isOpen && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onFreeTrial}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 active:bg-gray-50"
          >
            添加免费试用
          </button>
          <button
            type="button"
            onClick={onPaidMembership}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 active:bg-gray-50"
          >
            添加付费会员
          </button>
        </div>
      )}
    </div>
  )
}
