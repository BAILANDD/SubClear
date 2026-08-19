import { Link } from 'react-router-dom'
import { useState } from 'react'
import BoundaryNotice from '../components/BoundaryNotice'
import PageBackButton from '../components/PageBackButton'
import { useSubscriptions } from '../store/useSubscriptions'
import { exportCSV, exportJSON, type ExportDownloadResult } from '../utils/export'

type ExportKind = 'csv' | 'json'

export default function SettingsDataExport() {
  const { records } = useSubscriptions()
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    text: string
    retry?: ExportKind
  } | null>(null)

  const totalRecords = records.length

  function handleExport(kind: ExportKind) {
    const result = kind === 'csv' ? exportCSV(records) : exportJSON(records)
    handleExportResult(kind, result)
  }

  function handleExportResult(kind: ExportKind, result: ExportDownloadResult) {
    if (result.ok) {
      setFeedback({
        type: 'success',
        text: `${kind.toUpperCase()} 导出成功。`,
      })
      setTimeout(() => setFeedback(null), 3000)
      return
    }

    setFeedback({
      type: 'error',
      text: `导出失败。已保存记录没有被修改。你可以重试 ${kind.toUpperCase()} 导出。`,
      retry: kind,
    })
  }

  return (
    <div className="secondary-page space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">设置 / 数据</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            导出结构化记录，并查看原型的数据边界。
          </p>
        </div>
        <PageBackButton fallback="/" label="返回" />
      </div>

      <section className="rounded-lg border border-gray-100 px-3 py-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">数据导出</h3>
        <p className="mb-3 text-xs text-gray-500">
          {totalRecords > 0
            ? `${totalRecords} 条正式记录可导出。`
            : '没有可导出的已保存会员记录。'}
        </p>

        {totalRecords > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1.5 text-xs text-gray-500">
              <p>CSV 会以稳定列导出核心持久化会员事实。</p>
              <p>
                JSON 会导出结构化会员记录、证据元数据、存储元数据和带标签的派生快照。
              </p>
              <p className="text-gray-400">原始截图不会包含在导出文件中。</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-50"
              >
                导出 CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-50"
              >
                导出 JSON
              </button>
            </div>
          </div>
        ) : (
          <div>
            <Link to="/add-trial" className="inline-block text-sm font-medium text-blue-600 underline">
              + 添加记录
            </Link>
            <p className="mt-1 text-xs text-gray-400">请先添加记录，再使用数据导出。</p>
          </div>
        )}

        {feedback && (
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            <p>{feedback.text}</p>
            {feedback.retry && (
              <button
                type="button"
                onClick={() => handleExport(feedback.retry ?? 'csv')}
                className="mt-2 rounded-md border border-red-200 px-2 py-1 font-medium"
              >
                重试 {feedback.retry.toUpperCase()} 导出
              </button>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-100 px-3 py-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">隐私</h3>
        <BoundaryNotice text="保存的数据是结构化会员信息，不是原始截图备份。" />
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-gray-500">
          <li>截图上传由用户主动发起。</li>
          <li>SubClear 不会自动扫描你的相册。</li>
          <li>SubClear 不会自动读取短信或邮件。</li>
          <li>已选择的截图预览仅在当前会话中临时存在。</li>
          <li>原始截图不会存入 localStorage。</li>
          <li>已保存记录包含会员事实和证据元数据，不包含截图二进制。</li>
          <li>原始截图不会包含在导出文件中。</li>
        </ul>
      </section>

      <section className="rounded-lg border border-gray-100 px-3 py-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">原型边界</h3>
        <ul className="list-disc space-y-1 pl-4 text-xs text-gray-500">
          <li>稳定捕获 demo 使用确定性的去标识 fixture 路径。</li>
          <li>Fixture 路径不是生产级 OCR，也不是通用图像理解。</li>
          <li>OCR 技术验证是独立工作，当前稳定 demo 尚未实现。</li>
          <li>非 fixture 截图会安全失败，并可回退到手动录入。</li>
          <li>当前原型不声明模型准确率或校准置信分。</li>
        </ul>
      </section>

      <section className="rounded-lg border border-gray-100 px-3 py-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">产品边界</h3>
        <ul className="list-disc space-y-1 pl-4 text-xs text-gray-500">
          <li>SubClear 捕获并组织会员信息。</li>
          <li>SubClear 管理提醒配置和取消计划信息。</li>
          <li>SubClear 不执行支付、续费或取消操作。</li>
          <li>SubClear 不进行后台交易扫描。</li>
          <li>当前原型中的提醒为模拟状态，不会发送真实推送通知。</li>
        </ul>
      </section>
    </div>
  )
}
