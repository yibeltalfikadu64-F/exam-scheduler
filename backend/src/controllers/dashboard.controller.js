
'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const dashboardService = require('../services/dashboard.service');

const getDashboard = asyncHandler(async (req, res) => {
    const data = await dashboardService.getDashboard();

    return ApiResponse.success(
        res,
        data,
        'Dashboard data retrieved successfully.'
    );
});

module.exports = { getDashboard };
