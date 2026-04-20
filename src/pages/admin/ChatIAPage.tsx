import { useAdminCtx } from './AdminContext'
import { ChatIASection } from './DashboardPage'

export default function ChatIAPage() {
  const {
    chatDocuments, chatConfig, chatLeads,
    chatSubTab, setChatSubTab,
    handleUploadChatFile, chatUploading,
    chatDeleteTarget, setChatDeleteTarget, handleDeleteChatDocument,
    chatPrompt, setChatPrompt, chatPromptSaving, handleSaveChatPrompt, handleResetChatPrompt,
    chatSimMsgs, chatSimInput, setChatSimInput, chatSimLoading, chatSimUseCustom, setChatSimUseCustom, handleChatSimSend,
    chatLeadDetail, setChatLeadDetail, exportChatLeadsCSV,
  } = useAdminCtx()

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Chat IA</h1>
        <p className="text-sm text-slate-500 mt-1">Configura el asistente virtual de Contigo.</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <ChatIASection
          documents={chatDocuments}
          config={chatConfig}
          leads={chatLeads}
          subTab={chatSubTab}
          onSubTabChange={setChatSubTab}
          onUpload={handleUploadChatFile}
          uploading={chatUploading}
          deleteTarget={chatDeleteTarget}
          onDeleteTarget={setChatDeleteTarget}
          onDeleteConfirm={handleDeleteChatDocument}
          promptText={chatPrompt}
          onPromptTextChange={setChatPrompt}
          promptSaving={chatPromptSaving}
          onSavePrompt={handleSaveChatPrompt}
          onResetPrompt={handleResetChatPrompt}
          simMsgs={chatSimMsgs}
          simInput={chatSimInput}
          onSimInputChange={setChatSimInput}
          simLoading={chatSimLoading}
          simUseCustom={chatSimUseCustom}
          onSimUseCustomChange={setChatSimUseCustom}
          onSimSend={handleChatSimSend}
          leadDetail={chatLeadDetail}
          onLeadDetail={setChatLeadDetail}
          onExportLeads={exportChatLeadsCSV}
        />
      </div>
    </div>
  )
}
