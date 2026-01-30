import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { ContactFolder } from './FolderManager';

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: ContactFolder[];
  onImportComplete: () => void;
}

interface SheetData {
  name: string;
  data: any[];
  headers: string[];
}

interface ColumnMapping {
  nome: string;
  oficina: string;
  telefone: string;
  disparo: string;
}

const ImportContactsModal: React.FC<ImportContactsModalProps> = ({
  isOpen,
  onClose,
  folders,
  onImportComplete
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    nome: '',
    oficina: '',
    telefone: '',
    disparo: ''
  });
  const [targetFolderId, setTargetFolderId] = useState<string>('none');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      const parsedSheets: SheetData[] = workbook.SheetNames.map(name => {
        const worksheet = workbook.Sheets[name];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        const headers = jsonData[0] || [];
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));
        
        return {
          name,
          headers: headers.map(String),
          data: rows.map(row => {
            const obj: any = {};
            headers.forEach((header, i) => {
              obj[String(header)] = row[i];
            });
            return obj;
          })
        };
      });

      setSheets(parsedSheets);
      if (parsedSheets.length > 0) {
        setSelectedSheet(parsedSheets[0].name);
        autoMapColumns(parsedSheets[0].headers);
        setPreviewData(parsedSheets[0].data.slice(0, 5));
      }
    } catch (error) {
      console.error('Erro ao ler planilha:', error);
      toast.error('Erro ao ler o arquivo. Verifique se é uma planilha válida.');
    } finally {
      setLoading(false);
    }
  };

  const autoMapColumns = (headers: string[]) => {
    const mapping: ColumnMapping = {
      nome: '',
      oficina: '',
      telefone: '',
      disparo: ''
    };

    headers.forEach(header => {
      const lower = header.toLowerCase();
      if (lower.includes('nome') || lower.includes('name')) {
        mapping.nome = header;
      } else if (lower.includes('oficina') || lower.includes('empresa') || lower.includes('company')) {
        mapping.oficina = header;
      } else if (lower.includes('telefone') || lower.includes('phone') || lower.includes('celular') || lower.includes('whatsapp')) {
        mapping.telefone = header;
      } else if (lower.includes('disparo') || lower.includes('broadcast') || lower.includes('enviar')) {
        mapping.disparo = header;
      }
    });

    setColumnMapping(mapping);
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    const sheet = sheets.find(s => s.name === sheetName);
    if (sheet) {
      autoMapColumns(sheet.headers);
      setPreviewData(sheet.data.slice(0, 5));
    }
  };

  const normalizePhone = (phone: any): string => {
    if (!phone) return '';
    const str = String(phone).replace(/\D/g, '');
    // Se não tem DDI, adiciona o 55 (Brasil)
    if (str.length <= 11) {
      return '55' + str;
    }
    return str;
  };

  const parseDisparo = (value: any): boolean => {
    if (value === undefined || value === null || value === '') return false;
    const str = String(value).toLowerCase().trim();
    return ['sim', 'yes', 'true', '1', 's', 'y'].includes(str);
  };

  const handleImport = async () => {
    const sheet = sheets.find(s => s.name === selectedSheet);
    if (!sheet) return;

    if (!columnMapping.telefone) {
      toast.error('Você precisa mapear a coluna de telefone!');
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const contacts = sheet.data.map(row => ({
        name: row[columnMapping.nome] || null,
        phone_number: normalizePhone(row[columnMapping.telefone]),
        oficina: row[columnMapping.oficina] || null,
        disparo_enabled: columnMapping.disparo ? parseDisparo(row[columnMapping.disparo]) : false,
        folder_id: targetFolderId !== 'none' ? targetFolderId : null
      })).filter(c => c.phone_number.length >= 10);

      // Importar em lotes de 50
      const batchSize = 50;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from('contacts')
          .upsert(batch, { 
            onConflict: 'phone_number',
            ignoreDuplicates: false 
          })
          .select();

        if (error) {
          console.error('Erro no lote:', error);
          errorCount += batch.length;
        } else {
          successCount += data?.length || 0;
        }
      }

      toast.success(`Importação concluída! ${successCount} contatos importados.`);
      if (errorCount > 0) {
        toast.warning(`${errorCount} contatos não puderam ser importados.`);
      }
      
      onImportComplete();
      onClose();
    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error('Erro durante a importação');
    } finally {
      setImporting(false);
    }
  };

  const currentSheet = sheets.find(s => s.name === selectedSheet);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Importar Contatos</h2>
              <p className="text-sm text-slate-400">Importe contatos de uma planilha Excel ou CSV</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* File upload */}
          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all"
            >
              <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-lg text-slate-300 mb-2">Clique para selecionar uma planilha</p>
              <p className="text-sm text-slate-500">Suporta arquivos .xlsx, .xls e .csv</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mb-3" />
              <p className="text-slate-400">Processando planilha...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* File info and sheet selector */}
              <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg">
                <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
                <div className="flex-1">
                  <p className="font-medium text-white">{file.name}</p>
                  <p className="text-sm text-slate-400">{sheets.length} página(s) encontrada(s)</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setSheets([]);
                    setSelectedSheet('');
                    setPreviewData([]);
                  }}
                >
                  Trocar arquivo
                </Button>
              </div>

              {/* Sheet selector */}
              {sheets.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Selecione a página da planilha
                  </label>
                  <Select value={selectedSheet} onValueChange={handleSheetChange}>
                    <SelectTrigger className="w-full bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sheets.map(sheet => (
                        <SelectItem key={sheet.name} value={sheet.name}>
                          {sheet.name} ({sheet.data.length} linhas)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Column mapping */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3">Mapeamento de Colunas</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(['nome', 'oficina', 'telefone', 'disparo'] as const).map(field => (
                    <div key={field}>
                      <label className="block text-xs text-slate-400 mb-1 capitalize">
                        {field === 'disparo' ? 'Disparo (Sim/Não)' : field}
                        {field === 'telefone' && <span className="text-red-400">*</span>}
                      </label>
                      <Select
                        value={columnMapping[field] || 'none'}
                        onValueChange={(v) => setColumnMapping(prev => ({ ...prev, [field]: v === 'none' ? '' : v }))}
                      >
                        <SelectTrigger className="w-full bg-slate-800 border-slate-700 h-9 text-sm">
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Não mapear --</SelectItem>
                          {currentSheet?.headers.map(header => (
                            <SelectItem key={header} value={header}>{header}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target folder */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Importar para pasta
                </label>
                <Select value={targetFolderId} onValueChange={setTargetFolderId}>
                  <SelectTrigger className="w-full bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Sem pasta --</SelectItem>
                    {folders.map(folder => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preview */}
              {previewData.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-3">
                    Prévia (primeiras 5 linhas)
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-700">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs text-slate-400">Nome</th>
                          <th className="px-3 py-2 text-left text-xs text-slate-400">Oficina</th>
                          <th className="px-3 py-2 text-left text-xs text-slate-400">Telefone</th>
                          <th className="px-3 py-2 text-left text-xs text-slate-400">Disparo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {previewData.map((row, i) => (
                          <tr key={i} className="text-slate-300">
                            <td className="px-3 py-2">{row[columnMapping.nome] || '-'}</td>
                            <td className="px-3 py-2">{row[columnMapping.oficina] || '-'}</td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {normalizePhone(row[columnMapping.telefone]) || '-'}
                            </td>
                            <td className="px-3 py-2">
                              {columnMapping.disparo && parseDisparo(row[columnMapping.disparo]) ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <X className="w-4 h-4 text-slate-600" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Total: {currentSheet?.data.length || 0} contatos para importar
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {file && !loading && (
          <div className="flex items-center justify-between p-6 border-t border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <AlertCircle className="w-4 h-4" />
              Contatos duplicados serão atualizados
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || !columnMapping.telefone}
                className="min-w-32"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importar {currentSheet?.data.length || 0} contatos
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportContactsModal;
