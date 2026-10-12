'use strict';

/**
 * Academic calendar controllers (Phase 3, module 4): academic years + semesters.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const academicYearService = require('../services/academicYear.service');

function parseId(raw, label = 'academic year') {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest(`Invalid ${label} id.`, { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await academicYearService.listAcademicYears(req.validated.query), 'Academic years retrieved successfully.')
);

const options = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { academicYears: await academicYearService.listYearOptions() }, 'Academic year options retrieved.')
);

const getOne = asyncHandler(async (req, res) => {
  const academicYear = await academicYearService.getYearById(parseId(req.params.id));
  if (!academicYear) throw ApiError.notFound('Academic year not found.', { code: 'ACADEMIC_YEAR_NOT_FOUND' });
  return ApiResponse.success(res, { academicYear }, 'Academic year retrieved successfully.');
});

const create = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { academicYear: await academicYearService.createAcademicYear(req.body, req.user, requestMeta(req)) },
    'Academic year created successfully.',
    201
  )
);

const update = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { academicYear: await academicYearService.updateAcademicYear(parseId(req.params.id), req.body, req.user, requestMeta(req)) },
    'Academic year updated successfully.'
  )
);

const setStatus = asyncHandler(async (req, res) => {
  const academicYear = await academicYearService.setAcademicYearStatus(
    parseId(req.params.id),
    req.body.isActive,
    req.user,
    requestMeta(req)
  );
  return ApiResponse.success(
    res,
    { academicYear },
    req.body.isActive ? 'Academic year activated successfully.' : 'Academic year deactivated successfully.'
  );
});

// --- semesters (nested) ---

const listSemesters = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await academicYearService.listSemesters(parseId(req.params.id), req.validated.query),
    'Semesters retrieved successfully.'
  )
);

const createSemester = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    {
      semester: await academicYearService.createSemester(parseId(req.params.id), req.body, req.user, requestMeta(req)),
    },
    'Semester created successfully.',
    201
  )
);

const updateSemester = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    {
      semester: await academicYearService.updateSemester(
        parseId(req.params.id),
        parseId(req.params.semesterId, 'semester'),
        req.body,
        req.user,
        requestMeta(req)
      ),
    },
    'Semester updated successfully.'
  )
);

const setSemesterStatus = asyncHandler(async (req, res) => {
  const semester = await academicYearService.setSemesterStatus(
    parseId(req.params.id),
    parseId(req.params.semesterId, 'semester'),
    req.body.isActive,
    req.user,
    requestMeta(req)
  );
  return ApiResponse.success(
    res,
    { semester },
    req.body.isActive ? 'Semester activated successfully.' : 'Semester deactivated successfully.'
  );
});

module.exports = {
  list,
  options,
  getOne,
  create,
  update,
  setStatus,
  listSemesters,
  createSemester,
  updateSemester,
  setSemesterStatus,
};
