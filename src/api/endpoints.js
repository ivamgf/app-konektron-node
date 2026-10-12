// Rotas da API KonekTron v1 (ver /api/v1/docs/)
import { api } from './client.js';

export const authApi = {
  register: (body) => api.post('/auth/register', body, { auth: false }),
  login: (body) => api.post('/auth/login', body, { auth: false }),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }, { auth: false }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }, { auth: false }),
  resetPassword: (body) => api.post('/auth/reset-password', body, { auth: false }),
  logout: (body) => api.post('/auth/logout', body),
  me: () => api.get('/auth/me'),
  changePassword: (body) => api.post('/auth/change-password', body),
  resendVerification: () => api.post('/auth/resend-verification'),
  deleteAccount: (password) => api.del('/auth/me', { password }),
};

export const profileApi = {
  get: () => api.get('/profiles/me'),
  update: (body) => api.patch('/profiles/me', body),
};

export const engineeringApi = {
  sections: () => api.get('/engineering/sections'),
};

export const projectsApi = {
  list: (query) => api.get('/projects', query),
  get: (id) => api.get(`/projects/${id}`),
  create: (body) => api.post('/projects', body),
  update: (id, body) => api.patch(`/projects/${id}`, body),
  remove: (id) => api.del(`/projects/${id}`),
};

export const systemAnalysisApi = {
  overview: (pid) => api.get(`/projects/${pid}/system-analysis`),
  report: (pid) => api.get(`/projects/${pid}/system-analysis/report`),
  analysis: (pid) => api.get(`/projects/${pid}/system-analysis/analysis`),
  updateAnalysis: (pid, body) => api.patch(`/projects/${pid}/system-analysis/analysis`, body),
};

export const crispdmApi = {
  overview: (pid) => api.get(`/projects/${pid}/crisp-dm`),
  report: (pid) => api.get(`/projects/${pid}/crisp-dm/report`),
  phases: (pid) => api.get(`/projects/${pid}/crisp-dm/phases`),
  updatePhase: (pid, phase, body) => api.patch(`/projects/${pid}/crisp-dm/phases/${phase}`, body),
};

// CRUD genérico para os recursos que seguem o crudRouter da API
export const resourceApi = (basePath) => ({
  list: (query) => api.get(basePath, query),
  get: (id) => api.get(`${basePath}/${id}`),
  create: (body) => api.post(basePath, body),
  update: (id, body) => api.patch(`${basePath}/${id}`, body),
  remove: (id) => api.del(`${basePath}/${id}`),
});

export const adminApi = {
  summary: () => api.get('/admin/logs/summary'),
  users: (query) => api.get('/admin/users', query),
  updateUser: (id, body) => api.patch(`/admin/users/${id}`, body),
  removeUser: (id) => api.del(`/admin/users/${id}`),
  logs: (query) => api.get('/admin/logs', query),
};
