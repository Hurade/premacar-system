import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, GraduationCap, Sparkles, Users2, LineChart } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import RoleGate from '@/components/RoleGate'
import { BaseConhecimento } from '@/components/wiki/BaseConhecimento'
import { Trilhas } from '@/components/wiki/Trilhas'
import { PerguntarIA } from '@/components/wiki/PerguntarIA'
import { Simulador } from '@/components/wiki/Simulador'
import { PainelGestor } from '@/components/wiki/PainelGestor'

export default function Wiki() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'base')

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto custom-scrollbar">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Wiki</h2>
        <p className="text-sm text-muted-foreground mt-1">Base de conhecimento, trilhas de treinamento e agentes de IA da Prema.</p>
      </div>

      <Tabs defaultValue={activeTab} className="w-full" onValueChange={setActiveTab}>
        <div className="overflow-x-auto mb-6">
          <TabsList className="h-auto flex-wrap justify-start gap-1 w-full">
            <TabsTrigger value="base" className="gap-2">
              <BookOpen className="w-4 h-4" /> Base de Conhecimento
            </TabsTrigger>
            <TabsTrigger value="trilhas" className="gap-2">
              <GraduationCap className="w-4 h-4" /> Trilhas
            </TabsTrigger>
            <TabsTrigger value="ia" className="gap-2">
              <Sparkles className="w-4 h-4" /> Perguntar à IA
            </TabsTrigger>
            <TabsTrigger value="simulador" className="gap-2">
              <Users2 className="w-4 h-4" /> Simulador
            </TabsTrigger>
            <RoleGate allowedRoles={['admin', 'manager']} hideOnDenied>
              <TabsTrigger value="gestor" className="gap-2">
                <LineChart className="w-4 h-4" /> Painel do Gestor
              </TabsTrigger>
            </RoleGate>
          </TabsList>
        </div>

        <TabsContent value="base"><BaseConhecimento /></TabsContent>
        <TabsContent value="trilhas"><Trilhas /></TabsContent>
        <TabsContent value="ia"><PerguntarIA /></TabsContent>
        <TabsContent value="simulador"><Simulador /></TabsContent>
        <TabsContent value="gestor">
          <RoleGate allowedRoles={['admin', 'manager']}>
            <PainelGestor />
          </RoleGate>
        </TabsContent>
      </Tabs>
    </div>
  )
}
