'use strict';

/**
 * Section controllers (Phase 3, module 4).
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const sectionService = require('../services/section.service');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Invalid section id.', { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await sectionService.listSections(req.validated.query), 'Sections retrieved successfully.')
);

const getOne = asyncHandler(async (req, res) => {
  const section = await sectionService.getPublicById(parseId(req.params.id));
  if (!section) throw ApiError.notFound('Section not found.', { code: 'SECTION_NOT_FOUND' });
  return ApiResponse.success(res, { section }, 'Section retrieved successfully.');
});

const create = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { section: await sectionService.createSection(req.body, req.user, requestMeta(req)) },
    'Section created successfully.',
    201
  )
);

const update = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { section: await sectionService.updateSection(parseId(req.params.id), req.body, req.user, requestMeta(req)) },
    'Section updated successfully.'
  )
);

const setStatus = asyncHandler(async (req, res) => {
  const section = await sectionService.setSectionStatus(parseId(req.params.id), req.body.isActive, req.user, requestMeta(req));
  return ApiResponse.success(
    res,
    { section },
    req.body.isActive ? 'Section activated successfully.' : 'Section deactivated successfully.'
  );
});

module.exports = { list, getOne, create, update, setStatus };
