/**
 * Beta Testers Panel Component
 *
 * Dashboard UI for beta testers to access features and submit feedback
 */
import React, { useState } from "react";
import {
  useBetaTesterStatus,
  useBetaFeatures,
  useBetaPanel,
  submitBetaFeedback,
  BetaFeatureGuard,
  BetaFeatureLoader,
} from "../lib/useBetaTester";

export function BetaTesterPanel() {
  const { data: status, isLoading: statusLoading } = useBetaTesterStatus();
  const { data: panel, isLoading: panelLoading } = useBetaPanel();
  const { data: features, isLoading: featuresLoading } = useBetaFeatures();
  const [activeTab, setActiveTab] = useState<"info" | "features" | "feedback">(
    "info",
  );
  const [feedbackForm, setFeedbackForm] = useState({
    title: "",
    description: "",
    type: "general" as const,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitStatus("idle");

    try {
      await submitBetaFeedback(
        feedbackForm.title,
        feedbackForm.description,
        feedbackForm.type,
      );
      setSubmitStatus("success");
      setFeedbackForm({ title: "", description: "", type: "general" });
    } catch {
      setSubmitStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  // Not a beta tester
  if (status && !status.isBetaTester) {
    return (
      <div className="p-6 bg-red-900 bg-opacity-20 border border-red-500 rounded-lg">
        <h2 className="text-2xl font-bold text-red-400 mb-2">
          🔒 Acceso Denegado
        </h2>
        <p className="text-red-300">
          No eres un beta tester. Contacta con los desarrolladores si deseas
          unirte al programa.
        </p>
      </div>
    );
  }

  const isLoading = statusLoading || panelLoading || featuresLoading;

  return (
    <BetaFeatureGuard status={status}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-purple-900 bg-opacity-20 border border-purple-500 rounded-lg p-6">
          <h1 className="text-3xl font-bold text-purple-300 mb-2">
            🧪 Panel de Beta Testers
          </h1>
          <p className="text-purple-200">
            Accede a features experimentales y ayuda a mejorar Zero Two
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-2">⚙️</div>
              <p className="text-gray-400">Cargando panel de beta...</p>
            </div>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 border-b border-purple-500">
              {(
                ["info", "features", "feedback"] as const
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === tab
                      ? "text-purple-300 border-b-2 border-purple-500"
                      : "text-gray-400 hover:text-purple-300"
                  }`}
                >
                  {tab === "info" && "ℹ️ Información"}
                  {tab === "features" && "🎯 Features"}
                  {tab === "feedback" && "💬 Feedback"}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-gray-900 bg-opacity-50 rounded-lg p-6">
              {/* Info Tab */}
              {activeTab === "info" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-purple-300 mb-2">
                      ¿Qué es el Programa de Beta Testers?
                    </h3>
                    <p className="text-gray-300">
                      Un programa exclusivo donde usuarios seleccionados prueban
                      features experimentales antes que nadie y proporcionan
                      feedback para mejorarlas.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-green-300 mb-2">
                      ✅ Tu Status
                    </h3>
                    <p className="text-green-400 font-semibold">
                      ¡Eres un beta tester! 🎉
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-cyan-300 mb-2">
                      🎯 Beneficios
                    </h3>
                    <ul className="space-y-2 text-gray-300">
                      <li>✨ Acceso a features experimentales</li>
                      <li>🔧 Panel beta exclusivo</li>
                      <li>🐛 Poder reportar bugs</li>
                      <li>💡 Influir en decisiones del bot</li>
                      <li>🏆 Reconocimiento especial</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-yellow-300 mb-2">
                      📊 Features Habilitadas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {status?.features.betaFeaturesEnabled.map(
                        (feature) => (
                          <div
                            key={feature}
                            className="bg-purple-900 bg-opacity-30 border border-purple-500 rounded px-3 py-2 text-purple-300 capitalize"
                          >
                            ✓ {feature}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Features Tab */}
              {activeTab === "features" && (
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-cyan-300 mb-4">
                    🎯 Features en Beta
                  </h3>

                  {features?.features ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(features.features).map(
                        ([key, feature]: any) => (
                          <div
                            key={key}
                            className="border border-cyan-500 rounded-lg p-4 bg-cyan-900 bg-opacity-10"
                          >
                            <h4 className="text-lg font-bold text-cyan-300 mb-2">
                              {feature.name}
                            </h4>
                            <p className="text-gray-300 text-sm mb-3">
                              {feature.description}
                            </p>

                            <div className="flex items-center">
                              {feature.enabled ? (
                                <span className="text-green-400 text-sm font-semibold">
                                  ✅ Disponible
                                </span>
                              ) : (
                                <span className="text-red-400 text-sm font-semibold">
                                  ⏳ Próximamente
                                </span>
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400">No hay features disponibles</p>
                  )}
                </div>
              )}

              {/* Feedback Tab */}
              {activeTab === "feedback" && (
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-yellow-300 mb-4">
                    💬 Enviar Feedback
                  </h3>

                  <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Tipo de Feedback
                      </label>
                      <select
                        value={feedbackForm.type}
                        onChange={(e) =>
                          setFeedbackForm({
                            ...feedbackForm,
                            type: e.target.value as any,
                          })
                        }
                        className="w-full bg-gray-800 border border-purple-500 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-purple-400"
                      >
                        <option value="general">General</option>
                        <option value="bug">🐛 Bug</option>
                        <option value="feature">✨ Feature Suggestion</option>
                        <option value="suggestion">💡 Sugerencia</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Título
                      </label>
                      <input
                        type="text"
                        value={feedbackForm.title}
                        onChange={(e) =>
                          setFeedbackForm({
                            ...feedbackForm,
                            title: e.target.value,
                          })
                        }
                        placeholder="Describe el problema o sugerencia brevemente"
                        className="w-full bg-gray-800 border border-purple-500 rounded px-3 py-2 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Descripción
                      </label>
                      <textarea
                        value={feedbackForm.description}
                        onChange={(e) =>
                          setFeedbackForm({
                            ...feedbackForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="Proporciona más detalles..."
                        rows={5}
                        className="w-full bg-gray-800 border border-purple-500 rounded px-3 py-2 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-400 resize-none"
                        required
                      />
                    </div>

                    {submitStatus === "success" && (
                      <div className="bg-green-900 bg-opacity-30 border border-green-500 rounded p-3 text-green-300">
                        ✅ Feedback enviado correctamente. ¡Gracias! 💜
                      </div>
                    )}

                    {submitStatus === "error" && (
                      <div className="bg-red-900 bg-opacity-30 border border-red-500 rounded p-3 text-red-300">
                        ❌ Error al enviar feedback. Intenta de nuevo.
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-2 rounded transition-colors"
                    >
                      {submitting ? "Enviando..." : "Enviar Feedback"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </BetaFeatureGuard>
  );
}

export default BetaTesterPanel;
